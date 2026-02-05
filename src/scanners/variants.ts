/**
 * CVA Variant Scanner
 *
 * Extracts class-variance-authority (CVA) variant configurations
 * from React components. CVA is used to define component variants
 * like size, color, and style options.
 *
 * @module scanners/variants
 */

import fg from "fast-glob";
import { readFileSync } from "fs";

/** CVA variant configuration for a component */
export interface ComponentVariant {
  /** Component name */
  component: string;
  /** Variant options (e.g., { variant: ["default", "destructive"], size: ["sm", "md", "lg"] }) */
  variants: Record<string, string[]>;
  /** Default variant values if specified */
  defaultVariants?: Record<string, string>;
}

/**
 * Scans for CVA variant definitions in components
 *
 * @param dir - Project root directory
 * @returns Array of component variant configurations
 *
 * @example
 * const variants = await scanVariants('/path/to/project');
 * // Returns: [{ component: 'Button', variants: { variant: ['default', 'destructive'], size: ['sm', 'lg'] } }]
 */
export async function scanVariants(dir: string): Promise<ComponentVariant[]> {
  const files = await fg(["src/components/**/*.tsx", "components/**/*.tsx"], {
    cwd: dir,
    absolute: false,
  });

  const variants: ComponentVariant[] = [];

  for (const file of files) {
    const content = readFileSync(`${dir}/${file}`, "utf-8");

    // Check if file has cva import/usage
    if (!content.includes("cva(")) continue;

    // Look for variants block within cva - more flexible pattern
    const variantsBlockMatch = content.match(/variants\s*:\s*\{([\s\S]*?)\n\s{4}\}/);

    if (variantsBlockMatch) {
      const componentVariant = extractVariantsFromBlock(file, variantsBlockMatch[1]);
      if (componentVariant && Object.keys(componentVariant.variants).length > 0) {
        variants.push(componentVariant);
      }
    }
  }

  return variants;
}

/** Parses variant options from CVA variants block content */
function extractVariantsFromBlock(file: string, variantsContent: string): ComponentVariant | null {
  const component = getComponentNameFromFile(file);
  const result: ComponentVariant = {
    component,
    variants: {},
  };

  // Extract each variant type (e.g., variant, size) by looking for "name: {" pattern
  const variantTypeMatches = variantsContent.matchAll(/(\w+)\s*:\s*\{/g);
  const seenTypes = new Set<string>();

  for (const match of variantTypeMatches) {
    const variantType = match[1];
    if (seenTypes.has(variantType)) continue;
    seenTypes.add(variantType);

    // Find all option names for this variant type
    // Look for pattern like: optionName: cn(...) or optionName: "..."
    const typeStartIndex = variantsContent.indexOf(`${variantType}:`);
    if (typeStartIndex === -1) continue;

    // Find the content of this variant type block
    let depth = 0;
    let started = false;
    let blockContent = "";

    for (let i = typeStartIndex; i < variantsContent.length; i++) {
      const char = variantsContent[i];
      if (char === "{") {
        depth++;
        started = true;
      } else if (char === "}") {
        depth--;
        if (started && depth === 0) {
          blockContent = variantsContent.substring(typeStartIndex, i + 1);
          break;
        }
      }
    }

    if (blockContent) {
      // Extract option names from the block
      const optionMatches = blockContent.matchAll(/(\w+)\s*:\s*(?:cn\(|['"`])/g);
      const options: string[] = [];

      for (const optMatch of optionMatches) {
        const optName = optMatch[1];
        if (optName !== variantType && !options.includes(optName)) {
          options.push(optName);
        }
      }

      if (options.length > 0) {
        result.variants[variantType] = options;
      }
    }
  }

  return Object.keys(result.variants).length > 0 ? result : null;
}

/** Extracts component name from file path, converting kebab-case to PascalCase */
function getComponentNameFromFile(file: string): string {
  const parts = file.split("/");
  const fileName = parts.pop() || "";
  const name = fileName.replace(/\.(tsx|jsx)$/, "");

  // Convert kebab-case to PascalCase
  return name
    .split("-")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
