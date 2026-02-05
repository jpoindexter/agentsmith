/**
 * Barrel Export Scanner
 *
 * Finds index.ts files that re-export multiple components (barrel exports).
 * These provide cleaner import paths for consumers.
 *
 * @example
 * // Instead of:
 * import { Button } from '@/components/ui/button'
 * // Use:
 * import { Button } from '@/components/ui'
 *
 * @module scanners/barrels
 */

import fg from "fast-glob";
import { readFileSync } from "fs";

/** Barrel export information */
export interface BarrelExport {
  /** File path of the index.ts */
  path: string;
  /** Clean import path for consumers */
  importPath: string;
  /** Names re-exported from this barrel */
  exports: string[];
}

/**
 * Scans for barrel export files (index.ts with re-exports)
 *
 * @param dir - Project root directory
 * @returns Array of barrel exports with 3+ exports
 */
export async function scanBarrels(dir: string): Promise<BarrelExport[]> {
  const files = await fg(
    [
      "src/components/**/index.ts",
      "src/components/**/index.tsx",
      "components/**/index.ts",
      "components/**/index.tsx",
      "src/lib/**/index.ts",
      "src/hooks/index.ts",
      "!**/node_modules/**",
    ],
    {
      cwd: dir,
      absolute: false,
    }
  );

  const barrels: BarrelExport[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(`${dir}/${file}`, "utf-8");
      const exports = extractReExports(content);

      if (exports.length >= 3) {
        // Only include barrels with 3+ exports
        const importPath = toImportPath(file);
        barrels.push({
          path: file,
          importPath,
          exports,
        });
      }
    } catch {
      // Skip files we can't read
    }
  }

  return barrels.sort((a, b) => b.exports.length - a.exports.length);
}

/** Extracts re-exported names from barrel file content */
function extractReExports(content: string): string[] {
  const exports: string[] = [];

  // Match: export { Foo, Bar } from "./foo"
  const reExportMatches = content.matchAll(/export\s*\{([^}]+)\}\s*from/g);
  for (const match of reExportMatches) {
    const names = match[1]
      .split(",")
      .map((n) => n.trim().split(/\s+as\s+/)[0].trim())
      .filter((n) => /^[A-Z]/.test(n));
    exports.push(...names);
  }

  // Match: export * from "./foo"
  const starExportMatches = content.matchAll(/export\s*\*\s*from\s*["']([^"']+)["']/g);
  for (const match of starExportMatches) {
    // We can't know exact names from star exports, but note them
    exports.push(`* from ${match[1]}`);
  }

  return [...new Set(exports)];
}

/** Converts barrel file path to clean import path */
function toImportPath(file: string): string {
  // Remove index.ts(x) and convert to import path
  const withoutIndex = file.replace(/\/index\.(tsx?|jsx?)$/, "");
  const withoutExt = withoutIndex.replace(/\.(tsx?|jsx?)$/, "");

  if (withoutExt.startsWith("src/")) {
    return "@/" + withoutExt.slice(4);
  }

  return "@/" + withoutExt;
}
