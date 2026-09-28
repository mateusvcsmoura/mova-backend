import {
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { env } from "../../config/env.js";

export interface StorageObject {
  key: string;
  size?: number;
  lastModified?: Date;
}

export interface StorageProvider {
  putObject(input: { bucket: string; key: string; body: Buffer; contentType: string }): Promise<void>;
  copyObject(input: { sourceBucket: string; sourceKey: string; destinationBucket: string; destinationKey: string; contentType: string }): Promise<void>;
  deleteObject(input: { bucket: string; key: string }): Promise<void>;
  listObjects(input: { bucket: string }): Promise<StorageObject[]>;
}

const encodeCopySource = (bucket: string, key: string): string =>
  `${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;

export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;

  constructor(client?: S3Client) {
    this.client = client ?? new S3Client({
      endpoint: env.MEDIA_S3_ENDPOINT,
      region: env.MEDIA_S3_REGION,
      forcePathStyle: env.MEDIA_S3_FORCE_PATH_STYLE,
      ...(env.MEDIA_S3_ACCESS_KEY_ID && env.MEDIA_S3_SECRET_ACCESS_KEY
        ? { credentials: { accessKeyId: env.MEDIA_S3_ACCESS_KEY_ID, secretAccessKey: env.MEDIA_S3_SECRET_ACCESS_KEY } }
        : {}),
    });
  }

  async putObject({ bucket, key, body, contentType }: Parameters<StorageProvider["putObject"]>[0]): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }));
  }

  async copyObject({ sourceBucket, sourceKey, destinationBucket, destinationKey, contentType }: Parameters<StorageProvider["copyObject"]>[0]): Promise<void> {
    await this.client.send(new CopyObjectCommand({
      CopySource: encodeCopySource(sourceBucket, sourceKey),
      Bucket: destinationBucket,
      Key: destinationKey,
      ContentType: contentType,
      MetadataDirective: "REPLACE",
      CacheControl: "public, max-age=31536000, immutable",
    }));
  }

  async deleteObject({ bucket, key }: Parameters<StorageProvider["deleteObject"]>[0]): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  async listObjects({ bucket }: Parameters<StorageProvider["listObjects"]>[0]): Promise<StorageObject[]> {
    const result: StorageObject[] = [];
    let continuationToken: string | undefined;
    do {
      const page = await this.client.send(new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      }));
      for (const item of page.Contents ?? []) {
        if (item.Key) result.push({ key: item.Key, size: item.Size, lastModified: item.LastModified });
      }
      continuationToken = page.NextContinuationToken;
    } while (continuationToken);
    return result;
  }
}

export const publicMediaUrl = (objectKey: string): string =>
  `${env.MEDIA_PUBLIC_BASE_URL.replace(/\/$/, "")}/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
