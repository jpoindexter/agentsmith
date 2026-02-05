/**
 * Pattern Detection Scanner
 *
 * Identifies common code patterns and libraries used in the codebase:
 * - Form handling (react-hook-form, Zod)
 * - State management (Zustand, Redux, TanStack Query)
 * - Data fetching (tRPC, SWR)
 * - UI patterns (Radix Slot, forwardRef)
 * - Testing frameworks (Vitest, Jest, Playwright)
 *
 * @module scanners/patterns
 */

import fg from "fast-glob";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/** Detected code patterns and library usage */
export interface DetectedPatterns {
  /** react-hook-form installed */
  hasReactHookForm: boolean;
  /** Zod validation library installed */
  hasZod: boolean;
  /** Description of form handling pattern */
  formPattern?: string;

  /** Zustand state management */
  hasZustand: boolean;
  /** Redux state management */
  hasRedux: boolean;
  /** TanStack Query (react-query) */
  hasTanstackQuery: boolean;

  /** tRPC installed */
  hasTrpc: boolean;
  /** SWR data fetching */
  hasSwr: boolean;

  /** Radix Slot component (asChild pattern) */
  hasRadixSlot: boolean;
  /** React.forwardRef usage */
  hasForwardRef: boolean;

  /** Vitest testing framework */
  hasVitest: boolean;
  /** Jest testing framework */
  hasJest: boolean;
  /** Playwright E2E testing */
  hasPlaywright: boolean;

  /** Human-readable pattern descriptions */
  patterns: string[];
}

/**
 * Scans for common code patterns and library usage
 *
 * @param dir - Project root directory
 * @returns Detected patterns with boolean flags and descriptions
 *
 * @example
 * const patterns = await scanPatterns('/path/to/project');
 * console.log(patterns.patterns); // ["Forms: react-hook-form", "State: Zustand", ...]
 */
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
