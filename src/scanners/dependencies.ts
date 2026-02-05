/**
 * Component Dependencies Scanner
 *
 * Analyzes import statements in components to categorize their dependencies.
 * Useful for understanding component composition and design system usage.
 *
 * Categories:
 * - utilities: cn(), clsx, tailwind-merge
 * - designSystem: mode, tokens, theme
 * - radix: @radix-ui primitives
 * - internal: other project components
 * - external: third-party packages
 *
 * @module scanners/dependencies
 */

import fg from "fast-glob";
import { readFileSync } from "fs";

/** Component dependency analysis */
export interface ComponentDependency {
  /** Component name */
  component: string;
  /** File path */
  path: string;
  /** Categorized imports */
  imports: {
    /** Utility imports (cn, clsx, etc.) */
    utilities: string[];
    /** Design system imports (mode, tokens) */
    designSystem: string[];
    /** Radix UI primitives */
    radix: string[];
    /** Internal project imports */
    internal: string[];
    /** External package imports */
    external: string[];
  };
}

/**
 * Scans components for their import dependencies
 *
 * @param dir - Project root directory
 * @returns Array of component dependencies with notable imports
 */
export async function scanDependencies(dir: string): Promise<ComponentDependency[]> {
  const files = await fg(
    ["src/components/**/*.tsx", "components/**/*.tsx"],
    {
      cwd: dir,
      absolute: false,
    }
  );

  const dependencies: ComponentDependency[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(`${dir}/${file}`, "utf-8");
      const componentName = getComponentName(file);
      const imports = extractImports(content);

      // Only include components with notable imports
      if (
        imports.utilities.length > 0 ||
        imports.designSystem.length > 0 ||
        imports.radix.length > 0
      ) {
        dependencies.push({
          component: componentName,
          path: file,
          imports,
        });
      }
    } catch {
      // Skip files we can't read
    }
  }

  return dependencies.sort((a, b) => a.component.localeCompare(b.component));
}

/** Extracts component name from file path */
function getComponentName(file: string): string {
  const parts = file.split("/");
  const fileName = parts.pop() || "";
  return fileName.replace(/\.(tsx|jsx)$/, "")
    .split("-")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** Extracts and categorizes imports from file content */
function extractImports(content: string): ComponentDependency["imports"] {
  const utilities: string[] = [];
  const designSystem: string[] = [];
  const radix: string[] = [];
  const internal: string[] = [];
  const external: string[] = [];

  // Match all import statements
  const importMatches = content.matchAll(/import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+["']([^"']+)["']/g);

  for (const match of importMatches) {
    const namedImports = match[1]?.split(",").map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean) || [];
    const defaultImport = match[2];
    const source = match[3];

    // Categorize imports
    if (source.includes("@radix-ui")) {
      radix.push(source.split("/").pop() || source);
    } else if (source.includes("/lib/utils") || source.includes("clsx") || source.includes("tailwind-merge")) {
      for (const name of namedImports) {
        if (["cn", "clsx", "twMerge"].includes(name)) {
          utilities.push(name);
        }
      }
    } else if (source.includes("/design-system") || source.includes("/tokens") || source.includes("/theme")) {
      for (const name of namedImports) {
        designSystem.push(name);
      }
      if (defaultImport) {
        designSystem.push(defaultImport);
      }
    } else if (source.startsWith("@/components") || source.startsWith("./") || source.startsWith("../")) {
      for (const name of namedImports) {
        if (/^[A-Z]/.test(name)) {
          internal.push(name);
        }
      }
    } else if (source === "react" || source === "next" || source.startsWith("next/")) {
      // Skip common React/Next imports - they're assumed
    } else {
      if (defaultImport) {
        external.push(defaultImport);
      }
    }
  }

  return {
    utilities: [...new Set(utilities)],
    designSystem: [...new Set(designSystem)],
    radix: [...new Set(radix)],
    internal: [...new Set(internal)],
    external: [...new Set(external)],
  };
}
