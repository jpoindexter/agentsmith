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

/** API route information */
export interface ApiRoute {
  /** Route path (e.g., "/api/users/:id") */
  path: string;
  /** HTTP methods handled (GET, POST, PUT, DELETE, etc.) */
  methods: string[];
  /** Whether the route requires authentication */
  isProtected: boolean;
  /** Route description from JSDoc if available */
  description?: string;
}

/**
 * Scans for API routes in a Next.js project
 *
 * @param dir - Project root directory
 * @returns Array of discovered API routes
 *
 * @example
 * const routes = await scanApiRoutes('/path/to/project');
 * // Returns: [{ path: '/api/users/:id', methods: ['GET', 'PUT'], isProtected: true }]
 */
export async function scanApiRoutes(dir: string): Promise<ApiRoute[]> {
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
    const route = parseRoute(file, content);
    if (route) {
      routes.push(route);
    }
  }

  // Sort by path
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Parses a route file to extract HTTP methods and auth status
 * Supports both App Router (export function GET/POST) and Pages Router styles
 */
function parseRoute(file: string, content: string): ApiRoute | null {
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

  return {
    path,
    methods,
    isProtected,
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
