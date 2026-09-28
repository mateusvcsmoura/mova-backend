export interface ImageValidationLimits {
  maxBytes: number;
  maxWidth: number;
  maxHeight: number;
}

export interface ValidatedImage {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
}

const SUPPORTED = new Set<ValidatedImage["mimeType"]>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const fail = (message: string): never => {
  throw new Error(message);
};

function parsePng(buffer: Buffer): { width: number; height: number } {
  if (buffer.length < 33 || buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    return fail("Assinatura de imagem PNG inválida.");
  }
  let offset = 8;
  let dimensions: { width: number; height: number } | undefined;
  let ended = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) return fail("Imagem PNG truncada.");
    if (type === "eXIf") return fail("Metadados EXIF não são aceitos.");
    if (type === "IHDR") {
      if (length < 13 || dimensions) return fail("Cabeçalho PNG inválido.");
      dimensions = {
        width: buffer.readUInt32BE(dataStart),
        height: buffer.readUInt32BE(dataStart + 4),
      };
    }
    offset = dataEnd + 4;
    if (type === "IEND") {
      ended = true;
      break;
    }
  }
  if (!dimensions || !ended) return fail("Imagem PNG incompleta.");
  return dimensions;
}

function isJpegSof(marker: number): boolean {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function parseJpeg(buffer: Buffer): { width: number; height: number } {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return fail("Assinatura de imagem JPEG inválida.");
  }
  let offset = 2;
  let dimensions: { width: number; height: number } | undefined;
  let ended = false;
  while (offset < buffer.length) {
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset++];
    if (marker === undefined) break;
    if (marker === 0xd9) {
      ended = true;
      break;
    }
    if (marker === 0xda) {
      const length = buffer.readUInt16BE(offset);
      const scanStart = offset + length;
      const eoi = buffer.indexOf(Buffer.from([0xff, 0xd9]), scanStart);
      ended = eoi !== -1;
      break;
    }
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > buffer.length) return fail("Imagem JPEG truncada.");
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return fail("Imagem JPEG truncada.");
    const dataStart = offset + 2;
    if (marker === 0xe1 && buffer.subarray(dataStart, dataStart + 6).toString("ascii") === "Exif\0\0") {
      return fail("Metadados EXIF não são aceitos.");
    }
    if (isJpegSof(marker)) {
      if (length < 7) return fail("Cabeçalho JPEG inválido.");
      dimensions = {
        height: buffer.readUInt16BE(dataStart + 1),
        width: buffer.readUInt16BE(dataStart + 3),
      };
    }
    offset += length;
  }
  if (!dimensions || !ended) return fail("Imagem JPEG incompleta.");
  return dimensions;
}

function readLittleEndian24(buffer: Buffer, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function parseWebp(buffer: Buffer): { width: number; height: number } {
  if (
    buffer.length < 16 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return fail("Assinatura de imagem WebP inválida.");
  }
  let offset = 12;
  let dimensions: { width: number; height: number } | undefined;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd > buffer.length) return fail("Imagem WebP truncada.");
    if (type === "EXIF") return fail("Metadados EXIF não são aceitos.");
    if (type === "VP8X" && length >= 10 && !dimensions) {
      dimensions = {
        width: readLittleEndian24(buffer, dataStart + 4) + 1,
        height: readLittleEndian24(buffer, dataStart + 7) + 1,
      };
    }
    if (type === "VP8 " && length >= 10 && !dimensions && buffer[dataStart + 3] === 0x9d && buffer[dataStart + 4] === 0x01 && buffer[dataStart + 5] === 0x2a) {
      dimensions = {
        width: buffer.readUInt16LE(dataStart + 6) & 0x3fff,
        height: buffer.readUInt16LE(dataStart + 8) & 0x3fff,
      };
    }
    if (type === "VP8L" && length >= 6 && !dimensions && buffer[dataStart] === 0x2f) {
      const b1 = buffer[dataStart + 1];
      const b2 = buffer[dataStart + 2];
      const b3 = buffer[dataStart + 3];
      const b4 = buffer[dataStart + 4];
      const b5 = buffer[dataStart + 5] ?? 0;
      dimensions = {
        width: ((b1 | (b2 << 8) | ((b3 & 0x3f) << 16)) & 0x3ffff) + 1,
        height: (((b3 >> 6) | (b4 << 2) | ((b5 & 0xf) << 10)) & 0x3ffff) + 1,
      };
    }
    offset = dataEnd + (length % 2);
  }
  if (!dimensions) return fail("Cabeçalho WebP sem dimensões válidas.");
  return dimensions;
}

function detect(buffer: Buffer, mimeType: ValidatedImage["mimeType"]): { width: number; height: number } {
  if (mimeType === "image/png") return parsePng(buffer);
  if (mimeType === "image/jpeg") return parseJpeg(buffer);
  return parseWebp(buffer);
}

export function validateImageBuffer(
  buffer: Buffer,
  declaredMime: string,
  limits: ImageValidationLimits,
): ValidatedImage {
  if (buffer.length > limits.maxBytes) {
    return fail("Tamanho da imagem excede o limite configurado.");
  }
  const mimeType = declaredMime.trim().toLowerCase() as ValidatedImage["mimeType"];
  if (!SUPPORTED.has(mimeType)) {
    return fail("Formato de imagem não suportado; SVG não é aceito.");
  }
  const dimensions = detect(buffer, mimeType);
  if (dimensions.width < 1 || dimensions.height < 1) return fail("Dimensões de imagem inválidas.");
  if (dimensions.width > limits.maxWidth || dimensions.height > limits.maxHeight) {
    return fail("Dimensões da imagem excedem o limite configurado.");
  }
  return { mimeType, ...dimensions };
}
