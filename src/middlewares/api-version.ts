import { Request, Response, NextFunction } from "express";

export function apiMetadata(version: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;

    res.json = function (body: any) {
      return originalJson.call(this, {
        api_version: version,
        timestamp: new Date().toISOString(),
        docs: "https://github.com/mateusvcsmoura/mova-backend",
        success: res.statusCode < 400,
        ...body,
      });
    };

    next();
  };
}
