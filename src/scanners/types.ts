import fg from "fast-glob";
import { readFileSync } from "fs";
import { basename } from "path";

export interface TypeExport {
  name: string;
  kind: "interface" | "type" | "enum";
  file: string;
  properties?: string[];
  extends?: string;
  description?: string;
}

export interface TypeScanResult {
  types: TypeExport[];
  propsTypes: TypeExport[];
  apiTypes: TypeExport[];
  modelTypes: TypeExport[];
}

const TYPE_PATTERNS = [
  "src/**/*.{ts,tsx}",
  "types/**/*.{ts,tsx}",
  "lib/**/*.{ts,tsx}",
  "!**/*.test.*",
  "!**/*.spec.*",
  "!**/node_modules/**",
  "!**/generated/**",
];

export async function scanTypes(dir: string): Promise<TypeScanResult> {
  const files = await fg(TYPE_PATTERNS, {
    cwd: dir,
    absolute: false,
  });

  const allTypes: TypeExport[] = [];

  for (const file of files) {
    const content = readFileSync(`${dir}/${file}`, "utf-8");
    const types = extractTypes(content, file);
    allTypes.push(...types);
  }

  // Categorize types
  const propsTypes = allTypes.filter(t => t.name.endsWith("Props"));
  const apiTypes = allTypes.filter(t =>
    t.name.includes("Response") ||
    t.name.includes("Request") ||
    t.name.includes("Payload") ||
    t.name.includes("API") ||
    t.file.includes("/api/")
  );
  const modelTypes = allTypes.filter(t =>
    t.file.includes("/models/") ||
    t.file.includes("/types/") ||
    t.name.includes("Model") ||
    t.name.includes("Entity") ||
    t.name.includes("Schema")
  );

  // Remove duplicates from categories
  const propsSet = new Set(propsTypes.map(t => t.name));
  const apiSet = new Set(apiTypes.map(t => t.name));
  const modelSet = new Set(modelTypes.map(t => t.name));

  // Get remaining important types (not in other categories)
  const otherTypes = allTypes.filter(t =>
    !propsSet.has(t.name) &&
    !apiSet.has(t.name) &&
    !modelSet.has(t.name) &&
    isImportantType(t)
  );

  return {
    types: otherTypes.slice(0, 30),
    propsTypes: propsTypes.slice(0, 20),
    apiTypes: apiTypes.slice(0, 20),
    modelTypes: modelTypes.slice(0, 20),
  };
}

function extractTypes(content: string, file: string): TypeExport[] {
  const types: TypeExport[] = [];

  // Match exported interfaces
  const interfaceRegex = /(?:\/\*\*([^*]*(?:\*(?!\/)[^*]*)*)\*\/\s*)?export\s+interface\s+(\w+)(?:\s+extends\s+([^{]+))?\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs;

  let match;
  while ((match = interfaceRegex.exec(content)) !== null) {
    const [, jsdoc, name, extendsClause, body] = match;
    const properties = extractProperties(body);
    const description = jsdoc ? extractDescription(jsdoc) : undefined;

    types.push({
      name,
      kind: "interface",
      file,
      properties: properties.slice(0, 10),
      extends: extendsClause?.trim(),
      description,
    });
  }

  // Match exported type aliases
  const typeRegex = /(?:\/\*\*([^*]*(?:\*(?!\/)[^*]*)*)\*\/\s*)?export\s+type\s+(\w+)\s*=\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs;

  while ((match = typeRegex.exec(content)) !== null) {
    const [, jsdoc, name, body] = match;
    const properties = extractProperties(body);
    const description = jsdoc ? extractDescription(jsdoc) : undefined;

    types.push({
      name,
      kind: "type",
      file,
      properties: properties.slice(0, 10),
      description,
    });
  }

  // Match exported enums
  const enumRegex = /(?:\/\*\*([^*]*(?:\*(?!\/)[^*]*)*)\*\/\s*)?export\s+(?:const\s+)?enum\s+(\w+)\s*\{([^}]+)\}/gs;

  while ((match = enumRegex.exec(content)) !== null) {
    const [, jsdoc, name, body] = match;
    const values = body
      .split(",")
      .map(v => v.trim().split("=")[0].trim())
      .filter(Boolean)
      .slice(0, 10);
    const description = jsdoc ? extractDescription(jsdoc) : undefined;

    types.push({
      name,
      kind: "enum",
      file,
      properties: values,
      description,
    });
  }

  return types;
}

function extractProperties(body: string): string[] {
  const properties: string[] = [];
  const propRegex = /^\s*(\w+)\??:\s*([^;,\n]+)/gm;

  let match;
  while ((match = propRegex.exec(body)) !== null) {
    const [, name, type] = match;
    // Simplify type for display
    const simpleType = type.trim().split("|")[0].trim().slice(0, 30);
    properties.push(`${name}: ${simpleType}`);
  }

  return properties;
}

function extractDescription(jsdoc: string): string | undefined {
  const desc = jsdoc
    .replace(/^\s*\*\s?/gm, "")
    .replace(/@\w+.*$/gm, "")
    .trim()
    .split("\n")[0];

  return desc.length > 5 ? desc.slice(0, 100) : undefined;
}

function isImportantType(type: TypeExport): boolean {
  // Skip internal/utility types
  if (type.name.startsWith("_")) return false;
  if (type.name.endsWith("Internal")) return false;
  if (type.name.length < 4) return false;

  // Prioritize types with properties
  if (type.properties && type.properties.length > 2) return true;

  // Common important type patterns
  const importantPatterns = [
    /Config$/,
    /Options$/,
    /Settings$/,
    /State$/,
    /Context$/,
    /User/,
    /Auth/,
    /Session/,
    /Error$/,
    /Result$/,
  ];

  return importantPatterns.some(p => p.test(type.name));
}

export function formatTypes(result: TypeScanResult): string {
  const lines: string[] = [];

  if (result.propsTypes.length > 0) {
    lines.push("## Component Props Types");
    lines.push("");
    for (const type of result.propsTypes.slice(0, 15)) {
      const props = type.properties?.join(", ") || "";
      lines.push(`- **${type.name}** — \`${type.file}\``);
      if (props) {
        lines.push(`  - ${props.slice(0, 100)}${props.length > 100 ? "..." : ""}`);
      }
    }
    lines.push("");
  }

  if (result.apiTypes.length > 0) {
    lines.push("## API Types");
    lines.push("");
    for (const type of result.apiTypes.slice(0, 10)) {
      lines.push(`- **${type.name}** — \`${type.file}\``);
      if (type.description) {
        lines.push(`  - ${type.description}`);
      }
    }
    lines.push("");
  }

  if (result.modelTypes.length > 0) {
    lines.push("## Model Types");
    lines.push("");
    for (const type of result.modelTypes.slice(0, 10)) {
      const props = type.properties?.slice(0, 5).join(", ") || "";
      lines.push(`- **${type.name}** — ${props || type.file}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
