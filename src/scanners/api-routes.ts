/**
 * API Routes Scanner
 *
 * Discovers API routes in Next.js projects (both App Router and Pages Router).
 * Extracts HTTP methods, route paths, and authentication status.
 *
 * Supports:
 * - App Router: /app/api/\*\*\/route.ts
 * - Pages Router: /pages/api/\*\*\/*.ts
 *
 * @module scanners/api-routes
 */

import fg from "fast-glob";
import { readFileSync } from "fs";
import type { ApiRoute, ApiSchema, ApiField, TypeExport } from "../types.js";

/**
 * Scans for API routes in a Next.js project
 *
 * @param dir - Project root directory
 * @param typeExports - Optional type exports from types scanner for schema resolution
 * @returns Array of discovered API routes
 *
 * @example
 * const routes = await scanApiRoutes('/path/to/project');
 * // Returns: [{ path: '/api/users/:id', methods: ['GET', 'PUT'], isProtected: true }]
 */
export async function scanApiRoutes(dir: string, typeExports?: TypeExport[]): Promise<ApiRoute[]> {
  // Look for Next.js App Router API routes
  const files = await fg([
    "src/app/api/**/route.ts",
    "src/app/api/**/route.js",
    "app/api/**/route.ts",
    "app/api/**/route.js",
    // Also check pages router
    "src/pages/api/**/*.ts",
    "src/pages/api/**/*.js",
    "pages/api/**/*.ts",
    "pages/api/**/*.js",
  ], {
    cwd: dir,
    absolute: false,
  });

  const routes: ApiRoute[] = [];

  for (const file of files) {
    const content = readFileSync(`${dir}/${file}`, "utf-8");
    const route = parseRoute(file, content, typeExports);
    if (route) {
      routes.push(route);
    }
  }

  // Sort by path
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Parses a route file to extract HTTP methods, auth status, and schemas
 * Supports both App Router (export function GET/POST) and Pages Router styles
 */
function parseRoute(file: string, content: string, typeExports?: TypeExport[]): ApiRoute | null {
  const methods: string[] = [];
  if (content.includes("export async function GET") || content.includes("export function GET")) {
    methods.push("GET");
  }
  if (content.includes("export async function POST") || content.includes("export function POST")) {
    methods.push("POST");
  }
  if (content.includes("export async function PUT") || content.includes("export function PUT")) {
    methods.push("PUT");
  }
  if (content.includes("export async function PATCH") || content.includes("export function PATCH")) {
    methods.push("PATCH");
  }
  if (content.includes("export async function DELETE") || content.includes("export function DELETE")) {
    methods.push("DELETE");
  }

  // Pages router style (default export)
  if (methods.length === 0 && content.includes("export default")) {
    // Check for method handling in pages router
    if (content.includes("req.method")) {
      if (content.includes('"GET"') || content.includes("'GET'")) methods.push("GET");
      if (content.includes('"POST"') || content.includes("'POST'")) methods.push("POST");
      if (content.includes('"PUT"') || content.includes("'PUT'")) methods.push("PUT");
      if (content.includes('"DELETE"') || content.includes("'DELETE'")) methods.push("DELETE");
    }
    if (methods.length === 0) {
      methods.push("ALL"); // Default handler
    }
  }

  if (methods.length === 0) {
    return null;
  }

  // Convert file path to API path
  const path = fileToApiPath(file);

  // Check if route is protected (looks for auth/session checks)
  const isProtected =
    content.includes("auth()") ||
    content.includes("getSession") ||
    content.includes("getServerSession") ||
    content.includes("session?.user") ||
    content.includes("Unauthorized");

  // Extract schemas from Zod and TypeScript
  const zodSchemas = extractZodSchemas(content);
  const tsSchemas = extractTypeScriptSchemas(content);

  // Merge schemas (prefer Zod as it has validation info)
  let requestSchema = zodSchemas.requestSchema || tsSchemas.requestSchema;
  let responseSchema = zodSchemas.responseSchema || tsSchemas.responseSchema;
  const querySchema = zodSchemas.querySchema;

  // Only include request schema for methods that accept request bodies
  const hasBodyMethod = methods.some(m => ["POST", "PUT", "PATCH"].includes(m));
  if (!hasBodyMethod) {
    requestSchema = undefined;
  }

  // Resolve TypeScript type references if we have type exports
  if (typeExports) {
    if (requestSchema?.source === "typescript" && requestSchema.name) {
      requestSchema.fields = resolveTypeToFields(requestSchema.name, typeExports);
    }
    if (responseSchema?.source === "typescript" && responseSchema.name) {
      responseSchema.fields = resolveTypeToFields(responseSchema.name, typeExports);
    }
  }

  return {
    path,
    methods,
    isProtected,
    requestSchema,
    responseSchema,
    querySchema,
  };
}

/**
 * Converts a file path to an API route path
 * @example "src/app/api/users/[id]/route.ts" → "/api/users/:id"
 */
function fileToApiPath(file: string): string {
  let path = file
    .replace(/^src\//, "")
    .replace(/^pages/, "")
    .replace(/^app/, "")
    .replace(/\/route\.(ts|js)$/, "")
    .replace(/\.(ts|js)$/, "");

  // Convert [param] to :param for readability
  path = path.replace(/\[([^\]]+)\]/g, ":$1");

  // Ensure leading slash
  if (!path.startsWith("/")) {
    path = "/" + path;
  }

  return path;
}

/**
 * Extracts Zod schemas from route file content
 * Pattern matching based on env-vars.ts approach
 */
function extractZodSchemas(content: string): {
  requestSchema?: ApiSchema;
  responseSchema?: ApiSchema;
  querySchema?: ApiSchema;
} {
  const schemas: {
    requestSchema?: ApiSchema;
    responseSchema?: ApiSchema;
    querySchema?: ApiSchema;
  } = {};

  // Pattern: Named schema with object validation
  // const bodySchema = z.object({ name: z.string(), ... })
  const namedSchemaRegex = /const\s+(\w+(?:Schema|Type))\s*=\s*z\.object\s*\(\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}\s*\)/gs;

  // Find all schemas
  const allSchemas = new Map<string, ApiSchema>();
  let match;

  while ((match = namedSchemaRegex.exec(content)) !== null) {
    const [, schemaName, schemaBody] = match;
    const fields = parseZodFields(schemaBody);

    if (fields.length > 0) {
      allSchemas.set(schemaName, {
        source: "zod",
        name: schemaName,
        fields,
        isRequired: true,
      });
    }
  }

  // Match schemas to request/response based on context and naming
  for (const [schemaName, schema] of allSchemas) {
    const nameLower = schemaName.toLowerCase();

    // Check if this schema is used in request parsing
    const isUsedForRequest =
      content.includes(`${schemaName}.parse(`) &&
      (content.includes("req.json") || content.includes("request.json") || content.includes("await req.body"));

    // Query parameters schema
    if (
      nameLower.includes("query") ||
      nameLower.includes("search") ||
      nameLower.includes("params")
    ) {
      schemas.querySchema = schema;
    }
    // Response schema
    else if (
      nameLower.includes("response") ||
      nameLower.includes("output") ||
      nameLower.includes("result")
    ) {
      schemas.responseSchema = schema;
    }
    // Request body schema
    else if (
      nameLower.includes("body") ||
      nameLower.includes("request") ||
      nameLower.includes("input") ||
      nameLower.includes("create") ||
      nameLower.includes("update") ||
      isUsedForRequest
    ) {
      schemas.requestSchema = schema;
    }
  }

  return schemas;
}

/**
 * Parses Zod object fields into ApiField array with enhanced extraction
 * Extracts enums, arrays, unions, defaults, error messages, and nested objects
 */
function parseZodFields(zodBody: string): ApiField[] {
  const fields: ApiField[] = [];

  // Split by field boundaries (lines ending with comma, or end of object)
  // More reliable than complex regex for nested structures
  const lines = zodBody.split(/\n/).filter(l => l.trim());

  for (const line of lines) {
    // Match: fieldName: z.type(...)
    const fieldMatch = line.match(/(\w+)\s*:\s*z\.(\w+)\s*\((.*)/);
    if (!fieldMatch) continue;

    const [, fieldName, zodType] = fieldMatch;
    const restOfLine = fieldMatch[3]; // Everything after z.type(

    // Extract args (content within first parentheses)
    let args = '';
    let modifiers = '';
    let parenCount = 1;
    let i = 0;

    // Find matching closing paren for z.type(args)
    for (; i < restOfLine.length && parenCount > 0; i++) {
      if (restOfLine[i] === '(') parenCount++;
      else if (restOfLine[i] === ')') parenCount--;
      if (parenCount > 0) args += restOfLine[i];
    }

    // Rest is modifiers
    modifiers = restOfLine.slice(i);

    let fieldType = mapZodTypeToTs(zodType);
    const validations: string[] = [];
    let defaultValue: string | undefined;

    // Extract enum values
    if (zodType === "enum") {
      const enumValues = extractEnumValues(args);
      if (enumValues.length > 0) {
        fieldType = enumValues.map(v => `"${v}"`).join(" | ");
      } else {
        fieldType = "enum";
      }
      // Don't extract validations for enums - they don't have traditional validations
    }
    // Extract union values
    else if (zodType === "union") {
      fieldType = "union"; // Could be enhanced to extract union members
    }
    // Extract array item type
    else if (zodType === "array") {
      const arrayItemMatch = modifiers.match(/z\.(\w+)\(/);
      if (arrayItemMatch) {
        fieldType = `${mapZodTypeToTs(arrayItemMatch[1])}[]`;
      } else {
        fieldType = "Array";
      }
      // Extract validations for arrays
      const validationsWithMessages = extractValidations(modifiers, args);
      validations.push(...validationsWithMessages);
    }
    // Extract validations for other types
    else {
      const validationsWithMessages = extractValidations(modifiers, args);
      validations.push(...validationsWithMessages);
    }

    // Extract default value
    const defaultMatch = modifiers.match(/\.default\s*\(\s*['"`]?([^'"`\)]+)['"`]?\s*\)/);
    if (defaultMatch) {
      defaultValue = defaultMatch[1];
    }

    const field: ApiField = {
      name: fieldName,
      type: fieldType,
      isOptional: modifiers.includes(".optional()") || modifiers.includes(".nullable()"),
      validations: validations.length > 0 ? validations : undefined,
    };

    // Add default value to display
    if (defaultValue) {
      field.type = `${field.type} = ${defaultValue}`;
    }

    // Handle nested objects
    if (zodType === "object") {
      // Look for nested z.object({ ... })
      const nestedObjMatch = modifiers.match(/z\.object\s*\(\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}\s*\)/);
      if (nestedObjMatch) {
        field.nested = parseZodFields(nestedObjMatch[1]);
        field.type = "object";
      }
    }

    fields.push(field);
  }

  return fields;
}

/**
 * Maps Zod types to TypeScript display types
 */
function mapZodTypeToTs(zodType: string): string {
  const typeMap: Record<string, string> = {
    string: "string",
    number: "number",
    boolean: "boolean",
    date: "Date",
    array: "Array",
    object: "object",
    enum: "enum",
    literal: "literal",
    union: "union",
    any: "any",
    unknown: "unknown",
    void: "void",
    null: "null",
    undefined: "undefined",
    bigint: "bigint",
  };
  return typeMap[zodType] || zodType;
}

/**
 * Extracts validation rules from Zod modifiers with custom error messages
 */
function extractValidations(modifiers: string, args?: string): string[] {
  const validations: string[] = [];

  // Numeric validations with optional error messages
  const minMatch = modifiers.match(/\.min\s*\(\s*(\d+)(?:\s*,\s*['"`]([^'"`]+)['"`])?\s*\)/);
  if (minMatch) {
    const msg = minMatch[2] ? `, "${minMatch[2]}"` : '';
    validations.push(`min: ${minMatch[1]}${msg}`);
  }

  const maxMatch = modifiers.match(/\.max\s*\(\s*(\d+)(?:\s*,\s*['"`]([^'"`]+)['"`])?\s*\)/);
  if (maxMatch) {
    const msg = maxMatch[2] ? `, "${maxMatch[2]}"` : '';
    validations.push(`max: ${maxMatch[1]}${msg}`);
  }

  // String validations with messages
  const emailMatch = modifiers.match(/\.email\s*\(\s*(?:['"`]([^'"`]+)['"`])?\s*\)/);
  if (emailMatch) {
    validations.push(emailMatch[1] ? `email, "${emailMatch[1]}"` : "email");
  }

  if (modifiers.includes(".url(")) validations.push("url");
  if (modifiers.includes(".uuid(")) validations.push("uuid");
  if (modifiers.includes(".cuid(")) validations.push("cuid");

  // Length validations
  const lengthMatch = modifiers.match(/\.length\s*\(\s*(\d+)(?:\s*,\s*['"`]([^'"`]+)['"`])?\s*\)/);
  if (lengthMatch) {
    const msg = lengthMatch[2] ? `, "${lengthMatch[2]}"` : '';
    validations.push(`length: ${lengthMatch[1]}${msg}`);
  }

  // Extract error message from args if present (for base validations)
  if (args && args.includes(',')) {
    const argParts = args.split(',');
    if (argParts.length > 1) {
      const errorMsg = argParts[argParts.length - 1].trim().replace(/^['"`]|['"`]$/g, '');
      if (errorMsg && !validations.some(v => v.includes(errorMsg))) {
        // This is a base validation error message
        validations.push(`"${errorMsg}"`);
      }
    }
  }

  return validations;
}

/**
 * Extracts enum values from Zod enum definition
 */
function extractEnumValues(args: string): string[] {
  const values: string[] = [];

  // Match array of strings: ['value1', 'value2', ...]
  const arrayMatch = args.match(/\[([^\]]+)\]/);
  if (arrayMatch) {
    const items = arrayMatch[1].split(',');
    for (const item of items) {
      const cleaned = item.trim().replace(/^['"`]|['"`]$/g, '');
      if (cleaned) {
        values.push(cleaned);
      }
    }
  }

  return values;
}

/**
 * Links TypeScript types to API routes
 * Works with types.ts scanner results
 */
function extractTypeScriptSchemas(content: string): {
  requestSchema?: ApiSchema;
  responseSchema?: ApiSchema;
} {
  const schemas: {
    requestSchema?: ApiSchema;
    responseSchema?: ApiSchema;
  } = {};

  // Pattern 1: Return type annotation
  // export async function GET(): Promise<NextResponse<UserResponse>>
  // export async function POST(): Promise<Response<DataType>>
  const returnTypeRegex = /(?:Promise|Response)<(?:NextResponse|Response)<(\w+)>>/;
  const returnMatch = content.match(returnTypeRegex);

  if (returnMatch) {
    schemas.responseSchema = {
      source: "typescript",
      name: returnMatch[1],
      fields: [],
      isRequired: true,
    };
  }

  // Pattern 2: Request body type
  // const body: CreateUserRequest = await req.json();
  // const data: UserInput = await request.json();
  const bodyTypeRegex = /const\s+\w+\s*:\s*(\w+(?:Request|Body|Payload|Input|Data))\s*=/;
  const bodyMatch = content.match(bodyTypeRegex);

  if (bodyMatch) {
    schemas.requestSchema = {
      source: "typescript",
      name: bodyMatch[1],
      fields: [],
      isRequired: true,
    };
  }

  return schemas;
}

/**
 * Resolves TypeScript type name to field definitions
 * Uses TypeExport from types.ts scanner
 */
function resolveTypeToFields(typeName: string, typeExports: TypeExport[]): ApiField[] {
  const typeExport = typeExports.find((t) => t.name === typeName);
  if (!typeExport || !typeExport.properties) return [];

  return typeExport.properties.map((prop) => {
    // Parse "name: string" or "age?: number"
    const colonIndex = prop.indexOf(":");
    if (colonIndex === -1) {
      return {
        name: prop,
        type: "unknown",
        isOptional: false,
      };
    }

    const nameWithOptional = prop.substring(0, colonIndex).trim();
    const type = prop.substring(colonIndex + 1).trim();
    const isOptional = nameWithOptional.includes("?");
    const name = nameWithOptional.replace("?", "").trim();

    return {
      name,
      type: type || "unknown",
      isOptional,
    };
  });
}
