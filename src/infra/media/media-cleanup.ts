import type { StorageObject } from "./storage-provider.js";

export type CleanupObject = StorageObject & { bucket: string };

export function selecionarOrfaos(input: {
  referencedKeys: Set<string>;
  objects: CleanupObject[];
  now: Date;
  minAgeMs: number;
}): CleanupObject[] {
  return input.objects.filter((object) => {
    if (input.referencedKeys.has(object.key) || !object.lastModified) return false;
    return input.now.getTime() - object.lastModified.getTime() >= input.minAgeMs;
  });
}
