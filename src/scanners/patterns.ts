import fg from "fast-glob";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface DetectedPatterns {
  // Form handling
  hasReactHookForm: boolean;
  hasZod: boolean;
  formPattern?: string;

  // State management
  hasZustand: boolean;
  hasRedux: boolean;
  hasTanstackQuery: boolean;

  // Data fetching
  hasTrpc: boolean;
  hasSwr: boolean;

  // UI patterns
  hasRadixSlot: boolean;
  hasForwardRef: boolean;

  // Testing
  hasVitest: boolean;
  hasJest: boolean;
  hasPlaywright: boolean;

  // Common patterns detected
  patterns: string[];
}

export async function scanPatterns(dir: string): Promise<DetectedPatterns> {
  const result: DetectedPatterns = {
    hasReactHookForm: false,
    hasZod: false,
    hasZustand: false,
    hasRedux: false,
    hasTanstackQuery: false,
    hasTrpc: false,
    hasSwr: false,
    hasRadixSlot: false,
    hasForwardRef: false,
    hasVitest: false,
    hasJest: false,
    hasPlaywright: false,
    patterns: [],
  };

  // Check package.json for dependencies
  const pkgPath = join(dir, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    // Form handling
    if (deps["react-hook-form"]) {
      result.hasReactHookForm = true;
      result.patterns.push("Forms: react-hook-form");
    }
    if (deps["zod"]) {
      result.hasZod = true;
      if (deps["@hookform/resolvers"]) {
        result.formPattern = "react-hook-form + Zod validation";
        result.patterns.push("Form validation: Zod schemas with hookform resolver");
      }
    }

    // State management
    if (deps["zustand"]) {
      result.hasZustand = true;
      result.patterns.push("State: Zustand");
    }
    if (deps["@reduxjs/toolkit"] || deps["redux"]) {
      result.hasRedux = true;
      result.patterns.push("State: Redux");
    }
    if (deps["@tanstack/react-query"]) {
      result.hasTanstackQuery = true;
      result.patterns.push("Data fetching: TanStack Query");
    }

    // Data fetching
    if (deps["@trpc/client"] || deps["@trpc/server"]) {
      result.hasTrpc = true;
      result.patterns.push("API: tRPC");
    }
    if (deps["swr"]) {
      result.hasSwr = true;
      result.patterns.push("Data fetching: SWR");
    }

    // UI
    if (deps["@radix-ui/react-slot"]) {
      result.hasRadixSlot = true;
      result.patterns.push("Components: Radix Slot pattern (asChild)");
    }

    // Testing
    if (deps["vitest"]) {
      result.hasVitest = true;
      result.patterns.push("Testing: Vitest");
    }
    if (deps["jest"]) {
      result.hasJest = true;
      result.patterns.push("Testing: Jest");
    }
    if (deps["@playwright/test"]) {
      result.hasPlaywright = true;
      result.patterns.push("E2E Testing: Playwright");
    }
  }

  // Sample some component files to detect patterns
  const componentFiles = await fg(["src/components/**/*.tsx"], { cwd: dir, absolute: false });

  let forwardRefCount = 0;
  const sampleSize = Math.min(componentFiles.length, 20);

  for (let i = 0; i < sampleSize; i++) {
    const file = componentFiles[i];
    const content = readFileSync(`${dir}/${file}`, "utf-8");

    if (content.includes("React.forwardRef") || content.includes("forwardRef(")) {
      forwardRefCount++;
    }
  }

  if (forwardRefCount > sampleSize * 0.3) {
    result.hasForwardRef = true;
    result.patterns.push("Components: forwardRef pattern");
  }

  // Check for existing patterns documentation
  const patternFiles = [".ai/patterns.md", "docs/patterns.md"];
  for (const pf of patternFiles) {
    if (existsSync(join(dir, pf))) {
      result.patterns.push(`Documentation: ${pf} exists`);
      break;
    }
  }

  return result;
}
