import { readFileSync, existsSync } from "fs";
import { join } from "path";
import fg from "fast-glob";

export interface Utilities {
  hasCn: boolean;
  cnPath?: string;
  hasMode: boolean;
  modePath?: string;
  hasShadcn: boolean;
  radixPackages: string[];
  hasCva: boolean;
  customUtils: string[];
}

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
