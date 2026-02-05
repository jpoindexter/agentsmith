import fg from "fast-glob";
import { readFileSync } from "fs";
import { basename } from "path";
import type { Component } from "../types.js";

export interface TestCoverage {
  testFramework: "vitest" | "jest" | "playwright" | "testing-library" | "none";
  testFiles: string[];
  testedComponents: string[];
  untestedComponents: string[];
  coverage: number; // percentage 0-100
}

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
