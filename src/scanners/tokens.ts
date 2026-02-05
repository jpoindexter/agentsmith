/**
 * Design Token Scanner
 *
 * Extracts CSS design tokens from Tailwind CSS configuration and
 * CSS variable definitions. Discovers colors, spacing, radius, and fonts.
 *
 * Supports:
 * - Tailwind CSS v3 and v4 (with @theme blocks)
 * - CSS custom properties (:root variables)
 * - data-theme selectors for multi-theme setups
 *
 * @module scanners/tokens
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { Tokens } from "../types.js";

/** Tailwind config file locations to check */
const TAILWIND_CONFIG_FILES = [
  "tailwind.config.ts",
  "tailwind.config.js",
  "tailwind.config.mjs",
  "tailwind.config.cjs",
];

/** Global CSS file locations to check */
const CSS_FILES = [
  "src/app/globals.css",
  "src/styles/globals.css",
  "app/globals.css",
  "styles/globals.css",
  "globals.css",
];

/**
 * Scans for design tokens in CSS and Tailwind configuration
 *
 * @param dir - Project root directory
 * @returns Design tokens organized by category
 *
 * @example
 * const tokens = await scanTokens('/path/to/project');
 * // Returns: { colors: { primary: 'oklch(...)' }, radius: { radius: '0.5rem' }, ... }
 */
export async function scanTokens(dir: string): Promise<Tokens> {
  const tokens: Tokens = {
    colors: {},
    spacing: {},
    radius: {},
    fonts: [],
  };

  // Scan CSS for CSS variables
  for (const cssFile of CSS_FILES) {
    const path = join(dir, cssFile);
    if (existsSync(path)) {
      const content = readFileSync(path, "utf-8");
      extractCssVariables(content, tokens);
      break;
    }
  }

  // Scan Tailwind config for extended tokens
  for (const configFile of TAILWIND_CONFIG_FILES) {
    const path = join(dir, configFile);
    if (existsSync(path)) {
      const content = readFileSync(path, "utf-8");
      extractTailwindTokens(content, tokens);
      break;
    }
  }

  return tokens;
}

/** Extracts CSS variables from :root and @theme blocks */
function extractCssVariables(content: string, tokens: Tokens): void {
  const blockPatterns = [
    /:root\s*\{([^}]+)\}/g,
    /@theme\s*\{([^}]+)\}/g,
  ];

  for (const blockPattern of blockPatterns) {
    const blockMatches = content.matchAll(blockPattern);
    for (const blockMatch of blockMatches) {
      const blockContent = blockMatch[1];
      extractTokensFromBlock(blockContent, tokens);
    }
  }

  // Also look for theme blocks within data-theme selectors (Tailwind 4 themes)
  const themeMatches = content.matchAll(/\[data-theme[^\]]*\]\s*\{([^}]+)\}/g);
  for (const match of themeMatches) {
    // Only extract from first theme as reference
    extractTokensFromBlock(match[1], tokens);
    break;
  }
}

/** Parses CSS variable declarations and categorizes them */
function extractTokensFromBlock(blockContent: string, tokens: Tokens): void {
  const varMatches = blockContent.matchAll(/--([a-zA-Z][a-zA-Z0-9-]*):\s*([^;]+);/g);

  for (const match of varMatches) {
    const name = match[1];
    const value = match[2].trim();

    // Skip internal/private vars (starting with color- which are computed)
    if (name.startsWith("color-")) continue;

    // Categorize by name
    if (name === "radius" || name.includes("radius")) {
      tokens.radius[name] = value;
    } else if (name.includes("font")) {
      if (!tokens.fonts.includes(name)) {
        tokens.fonts.push(name);
      }
    } else if (isColorToken(name)) {
      // Only add if not already present (first theme wins)
      if (!tokens.colors[name]) {
        tokens.colors[name] = value;
      }
    }
  }
}

/** Determines if a CSS variable name represents a color token */
function isColorToken(name: string): boolean {
  const colorKeywords = [
    "background", "foreground", "primary", "secondary", "accent",
    "muted", "card", "popover", "border", "input", "ring",
    "destructive", "success", "warning", "info", "chart"
  ];
  return colorKeywords.some(keyword => name.includes(keyword));
}

/** Extracts extended theme tokens from Tailwind config */
function extractTailwindTokens(content: string, tokens: Tokens): void {
  const colorsMatch = content.match(/colors:\s*\{([^}]+)\}/);
  if (colorsMatch) {
    // Extract color keys (simplified - just gets the keys)
    const colorKeys = colorsMatch[1].matchAll(/(\w+):/g);
    for (const match of colorKeys) {
      if (!tokens.colors[match[1]]) {
        tokens.colors[match[1]] = "tailwind-extended";
      }
    }
  }

  // Look for fontFamily
  const fontMatch = content.match(/fontFamily:\s*\{([^}]+)\}/);
  if (fontMatch) {
    const fontKeys = fontMatch[1].matchAll(/(\w+):/g);
    for (const match of fontKeys) {
      if (!tokens.fonts.includes(match[1])) {
        tokens.fonts.push(match[1]);
      }
    }
  }
}
