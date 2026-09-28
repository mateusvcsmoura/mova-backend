import {
  CreateBucketCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { env } from "../../src/config/env.js";

const client = new S3Client({
  endpoint: env.MEDIA_S3_ENDPOINT,
  region: env.MEDIA_S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.MEDIA_S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: env.MEDIA_S3_SECRET_ACCESS_KEY ?? "",
  },
});

const buckets = [env.MEDIA_PRIVATE_BUCKET, env.MEDIA_PUBLIC_BUCKET];
for (const bucket of buckets) {
  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status !== 409) throw error;
  }
}

await client.send(new PutBucketPolicyCommand({
  Bucket: env.MEDIA_PUBLIC_BUCKET,
  Policy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [{
      Sid: "PublicReadOnlyImages",
      Effect: "Allow",
      Principal: "*",
      Action: ["s3:GetObject"],
      Resource: `arn:aws:s3:::${env.MEDIA_PUBLIC_BUCKET}/*`,
    }],
  }),
}));

await client.send(new PutBucketCorsCommand({
  Bucket: env.MEDIA_PUBLIC_BUCKET,
  CORSConfiguration: {
    CORSRules: [{
      AllowedMethods: ["GET", "HEAD"],
      AllowedOrigins: (env.CORS_ORIGINS ?? "http://localhost:5173").split(",").map((origin) => origin.trim()),
      AllowedHeaders: ["Content-Type"],
      MaxAgeSeconds: 3600,
    }],
  },
}));

console.log(JSON.stringify({ initialized: buckets }));
