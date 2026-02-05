/**
 * Test Coverage Scanner
 *
 * Analyzes test coverage by:
 * - Detecting the testing framework (Vitest, Jest, Playwright)
 * - Finding all test files
 * - Mapping tests to components
 * - Calculating coverage percentage
 *
 * @module scanners/tests
 */

import fg from "fast-glob";
import { readFileSync } from "fs";
import { basename } from "path";
import type { Component } from "../types.js";

/** Test coverage analysis results */
export interface TestCoverage {
  /** Detected testing framework */
  testFramework: "vitest" | "jest" | "playwright" | "testing-library" | "none";
  /** All test file paths */
  testFiles: string[];
  /** Component names that have tests */
  testedComponents: string[];
  /** Component names without tests */
  untestedComponents: string[];
  /** Coverage percentage (0-100) */
  coverage: number;
}

/**
 * Analyzes test coverage for components
 *
 * @param dir - Project root directory
 * @param components - Components discovered by the component scanner
 * @returns Test coverage analysis
 *
 * @example
 * const coverage = await scanTestCoverage('/path/to/project', components);
 * console.log(`${coverage.coverage}% of components have tests`);
 */
export async function scanTestCoverage(
  dir: string,
  components: Component[]
): Promise<TestCoverage> {
  // Detect test framework from package.json
  const testFramework = await detectTestFramework(dir);

  // Find all test files
  const testFiles = await fg(
    [
      "**/*.test.{ts,tsx,js,jsx}",
      "**/*.spec.{ts,tsx,js,jsx}",
      "**/__tests__/**/*.{ts,tsx,js,jsx}",
      "**/tests/**/*.{ts,tsx,js,jsx}",
      "**/test/**/*.{ts,tsx,js,jsx}",
    ],
    {
      cwd: dir,
      absolute: false,
      ignore: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    }
  );

  // Map test files to component names
  const testedComponentNames = new Set<string>();

  for (const testFile of testFiles) {
    // Extract component name from test file
    // Button.test.tsx -> Button
    // button.spec.ts -> button -> Button
    // __tests__/Button.tsx -> Button
    const fileName = basename(testFile)
      .replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/, "")
      .replace(/\.(ts|tsx|js|jsx)$/, "");

    // Try to match with component names (case-insensitive)
    for (const comp of components) {
      if (comp.name.toLowerCase() === fileName.toLowerCase()) {
        testedComponentNames.add(comp.name);
      }
      // Also check exports
      for (const exp of comp.exports) {
        if (exp.toLowerCase() === fileName.toLowerCase()) {
          testedComponentNames.add(comp.name);
        }
      }
    }

    // Also scan test file content for component imports
    try {
      const content = readFileSync(`${dir}/${testFile}`, "utf-8");
      for (const comp of components) {
        // Check if component is imported in the test
        const importPattern = new RegExp(`import.*\\b${comp.name}\\b.*from`, "i");
        if (importPattern.test(content)) {
          testedComponentNames.add(comp.name);
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  const testedComponents = Array.from(testedComponentNames).sort();
  const untestedComponents = components
    .map(c => c.name)
    .filter(name => !testedComponentNames.has(name))
    .sort();

  const coverage = components.length > 0
    ? Math.round((testedComponents.length / components.length) * 100)
    : 0;

  return {
    testFramework,
    testFiles,
    testedComponents,
    untestedComponents,
    coverage,
  };
}

/** Detects which testing framework is installed from package.json */
async function detectTestFramework(
  dir: string
): Promise<TestCoverage["testFramework"]> {
  try {
    const pkgPath = `${dir}/package.json`;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps.vitest || deps["@vitest/ui"]) {
      return "vitest";
    }
    if (deps.jest || deps["@types/jest"]) {
      return "jest";
    }
    if (deps["@playwright/test"]) {
      return "playwright";
    }
    if (deps["@testing-library/react"] || deps["@testing-library/dom"]) {
      return "testing-library";
    }
  } catch {
    // Ignore errors
  }

  return "none";
}
