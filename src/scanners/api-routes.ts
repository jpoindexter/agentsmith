import fg from "fast-glob";
import { readFileSync } from "fs";

export interface ApiRoute {
  path: string;
  methods: string[];
  isProtected: boolean;
  description?: string;
}

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

function parseRoute(file: string, content: string): ApiRoute | null {
  const methods: string[] = [];

  // Detect HTTP methods (App Router style)
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

function fileToApiPath(file: string): string {
  // Remove src/ prefix and file extension
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
