import { execFileSync } from "node:child_process";

// Credenciais do MinIO local lidas do próprio container (nunca impressas). Sem Docker/MinIO, nada é definido.
export function carregarCredenciaisMinio(container = process.env.MOVA_MINIO_CONTAINER || "mova-backend-minio-1"): void {
  if (process.env.MEDIA_S3_ACCESS_KEY_ID && process.env.MEDIA_S3_SECRET_ACCESS_KEY) return;
  try {
    const out = execFileSync(
      "docker",
      ["inspect", "--format", "{{range .Config.Env}}{{println .}}{{end}}", container],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const vars = Object.fromEntries(
      out.split(/\r?\n/).filter(Boolean).map((linha) => {
        const i = linha.indexOf("=");
        return [linha.slice(0, i), linha.slice(i + 1)];
      }),
    );
    if (vars.MINIO_ROOT_USER && vars.MINIO_ROOT_PASSWORD) {
      process.env.MEDIA_S3_ACCESS_KEY_ID = vars.MINIO_ROOT_USER;
      process.env.MEDIA_S3_SECRET_ACCESS_KEY = vars.MINIO_ROOT_PASSWORD;
    }
  } catch {
    // Sem Docker/MinIO: quem chama decide o que fazer sem imagens.
  }
}
