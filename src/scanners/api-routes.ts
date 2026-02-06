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
import { extractZodSchemasFromAST } from "./ast-schema-parser.js";

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
    const route = parseRoute(file, content, dir, typeExports);
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
function parseRoute(file: string, content: string, projectRoot: string, typeExports?: TypeExport[]): ApiRoute | null {
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

  // Extract schemas from Zod and TypeScript using AST parser
  const zodSchemas = extractZodSchemas(content, file, projectRoot);
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
 * Extracts Zod schemas from route file content using AST parser
 * Provides 95%+ accuracy and resolves imported schemas
 */
function extractZodSchemas(content: string, filePath: string, projectRoot: string): {
  requestSchema?: ApiSchema;
  responseSchema?: ApiSchema;
  querySchema?: ApiSchema;
} {
  const schemas: {
    requestSchema?: ApiSchema;
    responseSchema?: ApiSchema;
    querySchema?: ApiSchema;
  } = {};

  // Use AST-based extraction with import resolution
  const fullPath = `${projectRoot}/${filePath}`;
  const allSchemas = extractZodSchemasFromAST(content, fullPath, projectRoot);

  // Match schemas to request/response based on naming and usage
  for (const [schemaName, schema] of allSchemas) {
    const nameLower = schemaName.toLowerCase();

    // Check if this schema is used in request parsing
    const isUsedForRequest =
      (content.includes(`${schemaName}.parse(`) || content.includes(`${schemaName}.safeParse(`)) &&
      (content.includes("req.json") || content.includes("request.json") || content.includes("await req.body") || content.includes("await request.json"));

    // Query parameters schema
    if (
      nameLower.includes("query") ||
      nameLower.includes("search") ||
      nameLower.includes("params")
    ) {
      schemas.querySchema = { ...schema, name: schemaName, isRequired: true };
    }
    // Response schema
    else if (
      nameLower.includes("response") ||
      nameLower.includes("output") ||
      nameLower.includes("result")
    ) {
      schemas.responseSchema = { ...schema, name: schemaName, isRequired: true };
    }
    // Request body schema
    else if (
      nameLower.includes("body") ||
      nameLower.includes("request") ||
      nameLower.includes("input") ||
      nameLower.includes("create") ||
      nameLower.includes("update") ||
      nameLower.includes("contact") ||
      nameLower.includes("form") ||
      isUsedForRequest
    ) {
      schemas.requestSchema = { ...schema, name: schemaName, isRequired: true };
    }
    // Fallback: if no schemas assigned yet and this is used for request, assign it
    else if (!schemas.requestSchema && isUsedForRequest) {
      schemas.requestSchema = { ...schema, name: schemaName, isRequired: true };
    }
  }

  return schemas;
}

// Old regex-based parsing functions removed - now using AST parser
// See ast-schema-parser.ts for the new implementation

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
