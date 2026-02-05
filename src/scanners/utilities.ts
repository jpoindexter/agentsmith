/**
 * Utility Scanner
 *
 * Detects common utility functions and libraries in the codebase:
 * - cn() class merging utility (clsx/tailwind-merge)
 * - mode/design-system configuration
 * - shadcn/ui component library detection
 * - Radix UI primitives
 * - CVA (class-variance-authority)
 *
 * @module scanners/utilities
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import fg from "fast-glob";

/** Detected utility functions and libraries */
export interface Utilities {
  /** Whether cn() class merging utility exists */
  hasCn: boolean;
  /** Import path for cn() (e.g., "@/lib/utils") */
  cnPath?: string;
  /** Whether mode/design-system configuration exists */
  hasMode: boolean;
  /** Import path for mode */
  modePath?: string;
  /** Whether shadcn/ui is detected (Radix + CVA + cn) */
  hasShadcn: boolean;
  /** List of installed Radix UI packages */
  radixPackages: string[];
  /** Whether CVA (class-variance-authority) is installed */
  hasCva: boolean;
  /** Other custom utility functions found */
  customUtils: string[];
}

/**
 * Scans for utility functions and common libraries
 *
 * @param dir - Project root directory
 * @returns Detected utilities and their import paths
 *
 * @example
 * const utils = await scanUtilities('/path/to/project');
 * if (utils.hasCn) console.log(`cn() available at ${utils.cnPath}`);
 */
export async function scanUtilities(dir: string): Promise<Utilities> {
  const utils: Utilities = {
    hasCn: false,
    hasMode: false,
    hasShadcn: false,
    radixPackages: [],
    hasCva: false,
    customUtils: [],
  };

  // Check for cn() utility
  const utilPaths = [
    "src/lib/utils.ts",
    "src/lib/utils.tsx",
    "lib/utils.ts",
    "lib/utils.tsx",
    "src/utils.ts",
    "utils.ts",
  ];

  for (const utilPath of utilPaths) {
    const fullPath = join(dir, utilPath);
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath, "utf-8");
      if (content.includes("function cn(") || content.includes("const cn =") || content.includes("export function cn")) {
        utils.hasCn = true;
        utils.cnPath = utilPath.startsWith("src/") ? "@/" + utilPath.slice(4).replace(/\.tsx?$/, "") : "@/" + utilPath.replace(/\.tsx?$/, "");
      }

      // Extract other exported utils
      const utilMatches = content.matchAll(/export\s+(?:function|const)\s+([a-z][a-zA-Z0-9]*)/g);
      for (const match of utilMatches) {
        if (match[1] !== "cn") {
          utils.customUtils.push(match[1]);
        }
      }
      break;
    }
  }

  // Check for mode/design-system
  const designSystemPaths = [
    "src/design-system/index.ts",
    "src/design-system.ts",
    "design-system/index.ts",
  ];

  for (const dsPath of designSystemPaths) {
    const fullPath = join(dir, dsPath);
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath, "utf-8");
      if (content.includes("export") && (content.includes("mode") || content.includes("Mode"))) {
        utils.hasMode = true;
        utils.modePath = "@/design-system";
      }
      break;
    }
  }

  // Check package.json for Radix UI and CVA
  const pkgPath = join(dir, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    // Check for Radix UI packages
    for (const dep of Object.keys(deps)) {
      if (dep.startsWith("@radix-ui/react-")) {
        utils.radixPackages.push(dep.replace("@radix-ui/react-", ""));
      }
    }

    // Check for CVA
    if (deps["class-variance-authority"]) {
      utils.hasCva = true;
    }

    // shadcn detection: Radix + CVA + cn()
    if (utils.radixPackages.length > 5 && utils.hasCva && utils.hasCn) {
      utils.hasShadcn = true;
    }
  }

  return utils;
}
