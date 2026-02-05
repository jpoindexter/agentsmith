import fg from "fast-glob";
import { readFileSync } from "fs";
import { basename, dirname, relative } from "path";
import type { Component } from "../types.js";

const COMPONENT_PATTERNS = [
  // Primary: src/components folder (reusable components)
  "src/components/**/*.tsx",
  "src/components/**/*.jsx",
  "components/**/*.tsx",
  "components/**/*.jsx",
  // Exclusions
  "!**/node_modules/**",
  "!**/*.test.*",
  "!**/*.spec.*",
  "!**/*.stories.*",
];

// Next.js special files to skip (not reusable components)
const SKIP_FILES = [
  "page.tsx",
  "page.jsx",
  "layout.tsx",
  "layout.jsx",
  "loading.tsx",
  "loading.jsx",
  "error.tsx",
  "error.jsx",
  "not-found.tsx",
  "not-found.jsx",
  "template.tsx",
  "template.jsx",
  "default.tsx",
  "default.jsx",
  "route.ts",
  "route.js",
  "middleware.ts",
  "middleware.js",
];

export async function scanComponents(dir: string): Promise<Component[]> {
  const files = await fg(COMPONENT_PATTERNS, {
    cwd: dir,
    absolute: false,
  });

  const components: Component[] = [];

  for (const file of files) {
    // Skip Next.js special files
    const fileName = basename(file);
    if (SKIP_FILES.includes(fileName)) continue;

    const content = readFileSync(`${dir}/${file}`, "utf-8");
    const exports = extractExports(content);

    if (exports.length === 0) continue;

    const name = getComponentName(file, exports);
    const importPath = toImportPath(file);
    const props = extractProps(content);
    const description = extractJSDoc(content, exports[0]);

    components.push({
      name,
      path: file,
      importPath,
      exports,
      ...(props.length > 0 && { props }),
      ...(description && { description }),
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

function extractProps(content: string): string[] {
  const props: string[] = [];

  // Match interface XxxProps { ... }
  const interfaceMatch = content.match(/interface\s+\w*Props\s*(?:extends[^{]+)?\{([^}]+)\}/s);
  if (interfaceMatch) {
    const propsBlock = interfaceMatch[1];
    const propMatches = propsBlock.matchAll(/^\s*(\w+)\??:/gm);
    for (const match of propMatches) {
      props.push(match[1]);
    }
  }

  // Match type XxxProps = { ... }
  const typeMatch = content.match(/type\s+\w*Props\s*=\s*\{([^}]+)\}/s);
  if (typeMatch && props.length === 0) {
    const propsBlock = typeMatch[1];
    const propMatches = propsBlock.matchAll(/^\s*(\w+)\??:/gm);
    for (const match of propMatches) {
      props.push(match[1]);
    }
  }

  // Match React.ComponentProps or ComponentPropsWithoutRef
  const extendsMatch = content.match(/(?:React\.ComponentProps|ComponentPropsWithoutRef|ComponentPropsWithRef)<["'](\w+)["']>/);
  if (extendsMatch) {
    // Add a note that it extends native element props
    // Don't list all native props, just note it
  }

  // Filter out common internal props
  const filtered = props.filter(p => !["ref", "key", "children"].includes(p));

  return [...new Set(filtered)];
}

function extractJSDoc(content: string, componentName: string): string | undefined {
  // Look for JSDoc comment directly before the component export
  // Pattern: /** ... */ followed by export
  const patterns = [
    // /** ... */ export function ComponentName
    new RegExp(`\\/\\*\\*([\\s\\S]*?)\\*\\/\\s*export\\s+(?:function|const)\\s+${componentName}`, "m"),
    // /** ... */ export default function ComponentName
    new RegExp(`\\/\\*\\*([\\s\\S]*?)\\*\\/\\s*export\\s+default\\s+function\\s+${componentName}`, "m"),
    // General JSDoc at top of file (component description)
    /^\/\*\*([\s\S]*?)\*\//m,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const jsdoc = match[1];
      // Extract the description (first line after /** and before @)
      const descMatch = jsdoc.match(/^\s*\*?\s*([^@*\n][^\n]*)/m);
      if (descMatch) {
        const desc = descMatch[1].trim();
        // Skip if it's just "use client" or similar
        if (desc && !desc.startsWith("use ") && desc.length > 5) {
          return desc;
        }
      }
    }
  }

  return undefined;
}
