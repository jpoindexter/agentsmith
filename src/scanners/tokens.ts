import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { Tokens } from "../types.js";

const TAILWIND_CONFIG_FILES = [
  "tailwind.config.ts",
  "tailwind.config.js",
  "tailwind.config.mjs",
  "tailwind.config.cjs",
];

const CSS_FILES = [
  "src/app/globals.css",
  "src/styles/globals.css",
  "app/globals.css",
  "styles/globals.css",
  "globals.css",
];

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

function extractCssVariables(content: string, tokens: Tokens): void {
  // Match CSS variables in :root OR @theme blocks (Tailwind 4)
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

function extractTokensFromBlock(blockContent: string, tokens: Tokens): void {
  // Extract all CSS variables: --name: value;
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

function isColorToken(name: string): boolean {
  const colorKeywords = [
    "background", "foreground", "primary", "secondary", "accent",
    "muted", "card", "popover", "border", "input", "ring",
    "destructive", "success", "warning", "info", "chart"
  ];
  return colorKeywords.some(keyword => name.includes(keyword));
}

function extractTailwindTokens(content: string, tokens: Tokens): void {
  // Look for theme.extend.colors
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
