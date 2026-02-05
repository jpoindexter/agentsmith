/**
 * Component Scanner
 *
 * Discovers React components in a codebase by scanning for .tsx/.jsx files
 * in component directories. Extracts metadata including:
 * - Component name and file path
 * - Import path for use in code
 * - Exported names
 * - Props from TypeScript interfaces
 * - JSDoc descriptions
 * - Complexity metrics (imports, lines, hooks usage)
 *
 * @module scanners/components
 */

import fg from "fast-glob";
import { readFileSync } from "fs";
import { basename, dirname, relative } from "path";
import type { Component, ComponentComplexity } from "../types.js";

/** Glob patterns for finding component files */
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

/** Next.js special files that should not be treated as reusable components */
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

/**
 * Scans a directory for React components
 *
 * @param dir - Root directory to scan
 * @param excludePatterns - Additional glob patterns to exclude
 * @returns Array of discovered components with metadata
 *
 * @example
 * const components = await scanComponents('/path/to/project');
 * // Returns: [{ name: 'Button', path: 'src/components/ui/button.tsx', ... }]
 */
export async function scanComponents(dir: string, excludePatterns: string[] = []): Promise<Component[]> {
  const patterns = [
    ...COMPONENT_PATTERNS,
    ...excludePatterns.map(p => p.startsWith("!") ? p : `!${p}`),
  ];

  const files = await fg(patterns, {
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
    const complexity = extractComplexity(content, props.length);

    components.push({
      name,
      path: file,
      importPath,
      exports,
      ...(props.length > 0 && { props }),
      ...(description && { description }),
      complexity,
    });
  }

  // Sort by path for consistent output
  return components.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Extracts exported component names from file content
 * Matches various export patterns (named, default, const, function)
 */
function extractExports(content: string): string[] {
  const exports: string[] = [];

  // export function ComponentName
  const funcMatches = content.matchAll(/export\s+function\s+([A-Z][a-zA-Z0-9]*)/g);
  for (const match of funcMatches) {
    exports.push(match[1]);
  }

  // export const ComponentName
  const constMatches = content.matchAll(/export\s+const\s+([A-Z][a-zA-Z0-9]*)/g);
  for (const match of constMatches) {
    exports.push(match[1]);
  }

  // export default function ComponentName
  const defaultFuncMatches = content.matchAll(/export\s+default\s+function\s+([A-Z][a-zA-Z0-9]*)/g);
  for (const match of defaultFuncMatches) {
    exports.push(match[1]);
  }

  // export { ComponentName }
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

/**
 * Determines the primary component name from filename and exports
 * Prefers the export that matches the filename in PascalCase
 */
function getComponentName(file: string, exports: string[]): string {
  const fileName = basename(file, ".tsx").replace(".jsx", "");
  const pascalName = toPascalCase(fileName);

  if (exports.includes(pascalName)) {
    return pascalName;
  }

  // Otherwise use the first export
  return exports[0] || pascalName;
}

/** Converts kebab-case or snake_case to PascalCase */
function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Converts a file path to an import path
 * @example "src/components/ui/button.tsx" → "@/components/ui/button"
 */
function toImportPath(file: string): string {
  const withoutExt = file.replace(/\.(tsx|jsx)$/, "");

  if (withoutExt.startsWith("src/")) {
    return "@/" + withoutExt.slice(4);
  }

  return "@/" + withoutExt;
}

/**
 * Extracts prop names from TypeScript Props interface/type definitions
 * Filters out common internal props (ref, key, children)
 */
function extractProps(content: string): string[] {
  const props: string[] = [];

  // interface XxxProps { ... }
  const interfaceMatch = content.match(/interface\s+\w*Props\s*(?:extends[^{]+)?\{([^}]+)\}/s);
  if (interfaceMatch) {
    const propsBlock = interfaceMatch[1];
    const propMatches = propsBlock.matchAll(/^\s*(\w+)\??:/gm);
    for (const match of propMatches) {
      props.push(match[1]);
    }
  }

  // type XxxProps = { ... }
  const typeMatch = content.match(/type\s+\w*Props\s*=\s*\{([^}]+)\}/s);
  if (typeMatch && props.length === 0) {
    const propsBlock = typeMatch[1];
    const propMatches = propsBlock.matchAll(/^\s*(\w+)\??:/gm);
    for (const match of propMatches) {
      props.push(match[1]);
    }
  }

  // React.ComponentProps or ComponentPropsWithoutRef - skip listing native props
  content.match(/(?:React\.ComponentProps|ComponentPropsWithoutRef|ComponentPropsWithRef)<["'](\w+)["']>/);

  // Filter out common internal props
  const filtered = props.filter(p => !["ref", "key", "children"].includes(p));

  return [...new Set(filtered)];
}

/**
 * Calculates complexity metrics for a component
 * Includes import count, line count, and React hook detection
 */
function extractComplexity(content: string, propCount: number): ComponentComplexity {
  const importMatches = content.matchAll(/^import\s+/gm);
  const importCount = [...importMatches].length;

  // Count lines (non-empty)
  const lineCount = content.split("\n").filter(line => line.trim()).length;

  // Detect React hooks
  const hasState = /\buse(?:State|Reducer)\s*\(/.test(content);
  const hasEffects = /\buseEffect\s*\(/.test(content);
  const hasContext = /\buseContext\s*\(/.test(content);

  return {
    propCount,
    importCount,
    lineCount,
    hasState,
    hasEffects,
    hasContext,
  };
}

/**
 * Extracts JSDoc description from component documentation
 * Looks for JSDoc comments directly before the component export
 */
function extractJSDoc(content: string, componentName: string): string | undefined {
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
