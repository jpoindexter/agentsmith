/**
 * Framework Detection Scanner
 *
 * Detects the framework, language, and styling solution used in a project
 * by analyzing package.json and checking for configuration files.
 *
 * Supported frameworks:
 * - Next.js (with App/Pages Router detection)
 * - Remix
 * - Vite
 * - React
 * - Vue
 * - Svelte
 *
 * @module scanners/framework
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { Framework } from "../types.js";

/**
 * Detects the framework and tech stack used in a project
 *
 * @param dir - Project root directory
 * @returns Framework information including name, version, router type, and dependencies
 *
 * @example
 * const framework = await detectFramework('/path/to/project');
 * // Returns: { name: 'Next.js', version: '14.2.0', router: 'App Router', ... }
 */
export async function detectFramework(dir: string): Promise<Framework> {
  const framework: Framework = {
    name: "Unknown",
    language: "JavaScript",
  };

  // Read package.json
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) {
    return framework;
  }

  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  // Detect TypeScript
  if (deps.typescript || existsSync(join(dir, "tsconfig.json"))) {
    framework.language = "TypeScript";
  }

  // Detect framework
  if (deps.next) {
    framework.name = "Next.js";
    framework.version = deps.next.replace(/[\^~]/, "");

    // Detect router type
    if (existsSync(join(dir, "src/app")) || existsSync(join(dir, "app"))) {
      framework.router = "App Router";
    } else if (existsSync(join(dir, "src/pages")) || existsSync(join(dir, "pages"))) {
      framework.router = "Pages Router";
    }
  } else if (deps["@remix-run/react"] || deps.remix) {
    framework.name = "Remix";
    framework.version = deps["@remix-run/react"] || deps.remix;
  } else if (deps.vite) {
    framework.name = "Vite";
    framework.version = deps.vite?.replace(/[\^~]/, "");
  } else if (deps.react) {
    framework.name = "React";
    framework.version = deps.react?.replace(/[\^~]/, "");
  } else if (deps.vue) {
    framework.name = "Vue";
    framework.version = deps.vue?.replace(/[\^~]/, "");
  } else if (deps.svelte) {
    framework.name = "Svelte";
    framework.version = deps.svelte?.replace(/[\^~]/, "");
  }

  // Detect styling
  if (deps.tailwindcss) {
    framework.styling = "Tailwind CSS";
  } else if (deps["styled-components"]) {
    framework.styling = "styled-components";
  } else if (deps["@emotion/react"]) {
    framework.styling = "Emotion";
  }

  // Extract key dependency versions
  framework.versions = {};
  if (deps.react) {
    framework.versions.react = deps.react.replace(/[\^~]/, "");
  }
  if (deps.typescript) {
    framework.versions.typescript = deps.typescript.replace(/[\^~]/, "");
  }
  if (deps.tailwindcss) {
    framework.versions.tailwindcss = deps.tailwindcss.replace(/[\^~]/, "");
  }
  if (deps.prisma || deps["@prisma/client"]) {
    framework.versions.prisma = (deps.prisma || deps["@prisma/client"]).replace(/[\^~]/, "");
  }

  // Get Node.js version from engines
  if (pkg.engines?.node) {
    framework.versions.node = pkg.engines.node;
  }

  return framework;
}
