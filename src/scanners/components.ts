import fg from "fast-glob";
import { readFileSync } from "fs";
import { basename, dirname, relative } from "path";
import type { Component } from "../types.js";

const COMPONENT_PATTERNS = [
  "**/components/**/*.tsx",
  "**/components/**/*.jsx",
  "!**/node_modules/**",
  "!**/*.test.*",
  "!**/*.spec.*",
  "!**/*.stories.*",
];

export async function scanComponents(dir: string): Promise<Component[]> {
  const files = await fg(COMPONENT_PATTERNS, {
    cwd: dir,
    absolute: false,
  });

  const components: Component[] = [];

  for (const file of files) {
    const content = readFileSync(`${dir}/${file}`, "utf-8");
    const exports = extractExports(content);

    if (exports.length === 0) continue;

    const name = getComponentName(file, exports);
    const importPath = toImportPath(file);

    components.push({
      name,
      path: file,
      importPath,
      exports,
    });
  }

  // Sort by path for consistent output
  return components.sort((a, b) => a.path.localeCompare(b.path));
}

function extractExports(content: string): string[] {
  const exports: string[] = [];

  // Match: export function ComponentName
  const funcMatches = content.matchAll(/export\s+function\s+([A-Z][a-zA-Z0-9]*)/g);
  for (const match of funcMatches) {
    exports.push(match[1]);
  }

  // Match: export const ComponentName
  const constMatches = content.matchAll(/export\s+const\s+([A-Z][a-zA-Z0-9]*)/g);
  for (const match of constMatches) {
    exports.push(match[1]);
  }

  // Match: export default function ComponentName
  const defaultFuncMatches = content.matchAll(/export\s+default\s+function\s+([A-Z][a-zA-Z0-9]*)/g);
  for (const match of defaultFuncMatches) {
    exports.push(match[1]);
  }

  // Match: export { ComponentName }
  const namedExportMatches = content.matchAll(/export\s*\{\s*([^}]+)\s*\}/g);
  for (const match of namedExportMatches) {
    const names = match[1].split(",").map((n) => n.trim().split(" ")[0]);
    for (const name of names) {
      if (/^[A-Z]/.test(name)) {
        exports.push(name);
      }
    }
  }

  return [...new Set(exports)];
}

function getComponentName(file: string, exports: string[]): string {
  // Prefer the main export that matches the file name
  const fileName = basename(file, ".tsx").replace(".jsx", "");
  const pascalName = toPascalCase(fileName);

  if (exports.includes(pascalName)) {
    return pascalName;
  }

  // Otherwise use the first export
  return exports[0] || pascalName;
}

function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function toImportPath(file: string): string {
  // Convert src/components/ui/button.tsx to @/components/ui/button
  const withoutExt = file.replace(/\.(tsx|jsx)$/, "");

  if (withoutExt.startsWith("src/")) {
    return "@/" + withoutExt.slice(4);
  }

  return "@/" + withoutExt;
}
