import fg from "fast-glob";
import { readFileSync, statSync } from "fs";

export interface FileStats {
  totalFiles: number;
  totalLines: number;
  totalSize: number; // in bytes
  largestFiles: { path: string; lines: number }[];
  filesByType: Record<string, number>;
}

export async function scanStats(dir: string): Promise<FileStats> {
  const files = await fg(
    [
      "**/*.{ts,tsx,js,jsx,css,scss,json,md}",
      "!**/node_modules/**",
      "!**/.next/**",
      "!**/dist/**",
      "!**/build/**",
      "!**/.git/**",
      "!**/coverage/**",
      "!**/*.min.js",
      "!**/package-lock.json",
      "!**/pnpm-lock.yaml",
      "!**/yarn.lock",
    ],
    {
      cwd: dir,
      absolute: false,
    }
  );

  let totalLines = 0;
  let totalSize = 0;
  const filesByType: Record<string, number> = {};
  const fileSizes: { path: string; lines: number }[] = [];

  for (const file of files) {
    try {
      const fullPath = `${dir}/${file}`;
      const stat = statSync(fullPath);
      totalSize += stat.size;

      const content = readFileSync(fullPath, "utf-8");
      const lines = content.split("\n").length;
      totalLines += lines;

      fileSizes.push({ path: file, lines });

      // Track by extension
      const ext = file.split(".").pop() || "other";
      filesByType[ext] = (filesByType[ext] || 0) + 1;
    } catch {
      // Skip files we can't read
    }
  }

  // Get top 5 largest files by lines
  const largestFiles = fileSizes
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 5);

  return {
    totalFiles: files.length,
    totalLines,
    totalSize,
    largestFiles,
    filesByType,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
