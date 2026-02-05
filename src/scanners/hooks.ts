import fg from "fast-glob";
import { readFileSync } from "fs";
import { basename } from "path";

export interface Hook {
  name: string;
  path: string;
  importPath: string;
  isClientOnly: boolean;
}

const HOOK_PATTERNS = [
  "src/hooks/**/*.ts",
  "src/hooks/**/*.tsx",
  "hooks/**/*.ts",
  "hooks/**/*.tsx",
  "!**/node_modules/**",
  "!**/*.test.*",
  "!**/*.spec.*",
  "!**/index.ts",  // Skip barrel exports
];

export async function scanHooks(dir: string): Promise<Hook[]> {
  const files = await fg(HOOK_PATTERNS, {
    cwd: dir,
    absolute: false,
  });

  const hooks: Hook[] = [];

  for (const file of files) {
    const content = readFileSync(`${dir}/${file}`, "utf-8");
    const hookNames = extractHookNames(content);
    const isClientOnly = content.includes("'use client'") || content.includes('"use client"');

    for (const name of hookNames) {
      hooks.push({
        name,
        path: file,
        importPath: toImportPath(file),
        isClientOnly,
      });
    }
  }

  return hooks.sort((a, b) => a.name.localeCompare(b.name));
}

function extractHookNames(content: string): string[] {
  const hooks: string[] = [];

  // Match: export function useXxx
  const funcMatches = content.matchAll(/export\s+function\s+(use[A-Z][a-zA-Z0-9]*)/g);
  for (const match of funcMatches) {
    hooks.push(match[1]);
  }

  // Match: export const useXxx
  const constMatches = content.matchAll(/export\s+const\s+(use[A-Z][a-zA-Z0-9]*)/g);
  for (const match of constMatches) {
    hooks.push(match[1]);
  }

  return [...new Set(hooks)];
}

function toImportPath(file: string): string {
  const withoutExt = file.replace(/\.(tsx?|jsx?)$/, "");
  if (withoutExt.startsWith("src/")) {
    return "@/" + withoutExt.slice(4);
  }
  return "@/" + withoutExt;
}
