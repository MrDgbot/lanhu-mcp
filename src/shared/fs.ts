import { access, mkdir } from "node:fs/promises";
import path from "node:path";

export async function ensureDirectory(directoryPath: string): Promise<string> {
  await mkdir(directoryPath, { recursive: true });
  return directoryPath;
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function resolveProjectPath(...segments: string[]): string {
  return path.resolve(process.cwd(), ...segments);
}
