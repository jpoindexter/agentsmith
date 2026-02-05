/**
 * Monorepo Detection Scanner
 *
 * Detects monorepo configurations and discovers workspace packages:
 * - npm/yarn workspaces (package.json workspaces field)
 * - pnpm workspaces (pnpm-workspace.yaml)
 * - Lerna (lerna.json)
 *
 * @module scanners/monorepo
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import fg from "fast-glob";

/** Information about a single package in a monorepo */
export interface MonorepoPackage {
  /** Package name from package.json */
  name: string;
  /** Absolute path to package directory */
  path: string;
  /** Relative path from monorepo root */
  relativePath: string;
  /** Whether package.json exists */
  hasPackageJson: boolean;
}

/** Monorepo detection results */
export interface MonorepoInfo {
  /** Whether a monorepo was detected */
  isMonorepo: boolean;
  /** Monorepo tool type */
  type: "npm" | "pnpm" | "yarn" | "lerna" | "unknown";
  /** List of discovered packages */
  packages: MonorepoPackage[];
  /** Root package name if available */
  rootName?: string;
}

/**
 * Detects monorepo configuration and discovers packages
 *
 * @param dir - Project root directory
 * @returns Monorepo information including all discovered packages
 *
 * @example
 * const info = await detectMonorepo('/path/to/project');
 * if (info.isMonorepo) {
 *   console.log(`Found ${info.packages.length} packages in ${info.type} monorepo`);
 * }
 */
export async function detectMonorepo(dir: string): Promise<MonorepoInfo> {
  const result: MonorepoInfo = {
    isMonorepo: false,
    type: "unknown",
    packages: [],
  };

  // Check for root package.json
  const pkgPath = join(dir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      result.rootName = pkg.name;

      // npm/yarn workspaces
      if (pkg.workspaces) {
        result.isMonorepo = true;
        result.type = "npm";
        const workspacePatterns = Array.isArray(pkg.workspaces)
          ? pkg.workspaces
          : pkg.workspaces.packages || [];

        result.packages = await findPackages(dir, workspacePatterns);
      }
    } catch {
      // Invalid package.json
    }
  }

  // Check for pnpm-workspace.yaml
  const pnpmPath = join(dir, "pnpm-workspace.yaml");
  if (!result.isMonorepo && existsSync(pnpmPath)) {
    try {
      const content = readFileSync(pnpmPath, "utf-8");
      // Simple yaml parsing for packages array
      const match = content.match(/packages:\s*\n((?:\s+-\s*['"]?[^\n]+['"]?\n?)+)/);
      if (match) {
        result.isMonorepo = true;
        result.type = "pnpm";
        const patterns = match[1]
          .split("\n")
          .map(line => line.trim().replace(/^-\s*['"]?/, "").replace(/['"]?$/, ""))
          .filter(Boolean);

        result.packages = await findPackages(dir, patterns);
      }
    } catch {
      // Invalid pnpm-workspace.yaml
    }
  }

  // Check for lerna.json
  const lernaPath = join(dir, "lerna.json");
  if (!result.isMonorepo && existsSync(lernaPath)) {
    try {
      const lerna = JSON.parse(readFileSync(lernaPath, "utf-8"));
      if (lerna.packages) {
        result.isMonorepo = true;
        result.type = "lerna";
        result.packages = await findPackages(dir, lerna.packages);
      }
    } catch {
      // Invalid lerna.json
    }
  }

  return result;
}

/** Finds packages matching workspace patterns */
async function findPackages(
  dir: string,
  patterns: string[]
): Promise<MonorepoPackage[]> {
  const packages: MonorepoPackage[] = [];

  // Convert workspace patterns to glob patterns
  const globPatterns = patterns.map(p => {
    // Handle patterns like "packages/*" -> "packages/*/package.json"
    if (p.endsWith("/*")) {
      return p + "/package.json";
    }
    // Handle patterns like "packages/**" -> "packages/**/package.json"
    if (p.endsWith("/**")) {
      return p + "/package.json";
    }
    // Handle patterns like "apps/web" -> "apps/web/package.json"
    return p + "/package.json";
  });

  const packageJsonFiles = await fg(globPatterns, {
    cwd: dir,
    absolute: false,
    ignore: ["**/node_modules/**"],
  });

  for (const pkgFile of packageJsonFiles) {
    const pkgPath = join(dir, pkgFile);
    const relativePath = pkgFile.replace("/package.json", "");
    const fullPath = join(dir, relativePath);

    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      packages.push({
        name: pkg.name || relativePath,
        path: fullPath,
        relativePath,
        hasPackageJson: true,
      });
    } catch {
      // Skip invalid package.json
    }
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

/** Formats monorepo overview as markdown documentation */
export function formatMonorepoOverview(info: MonorepoInfo): string {
  const lines: string[] = [];

  lines.push("## Monorepo Structure");
  lines.push("");
  lines.push(`This is a **${info.type}** monorepo with ${info.packages.length} packages:`);
  lines.push("");

  for (const pkg of info.packages) {
    lines.push(`- **${pkg.name}** — \`${pkg.relativePath}/\``);
  }
  lines.push("");

  lines.push("Each package has its own AGENTS.md with detailed context.");
  lines.push("");

  return lines.join("\n");
}
