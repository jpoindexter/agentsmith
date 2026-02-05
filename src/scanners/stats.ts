/**
 * File Statistics Scanner
 *
 * Collects codebase statistics including:
 * - Total file count
 * - Total lines of code
 * - Total size in bytes
 * - Largest files
 * - File count by extension
 *
 * @module scanners/stats
 */

import fg from "fast-glob";
import { readFileSync, statSync } from "fs";

/** File statistics for the codebase */
export interface FileStats {
  /** Total number of files scanned */
  totalFiles: number;
  /** Total lines of code */
  totalLines: number;
  /** Total size in bytes */
  totalSize: number;
  /** Largest files by line count */
  largestFiles: { path: string; lines: number }[];
  /** File count by extension */
  filesByType: Record<string, number>;
}

/**
 * Scans for file statistics in the codebase
 *
 * @param dir - Project root directory
 * @returns File statistics summary
 */
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

/** Formats bytes into human-readable string (B, KB, MB) */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
