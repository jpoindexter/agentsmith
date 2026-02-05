import fg from "fast-glob";
import { readFileSync } from "fs";
import { basename, dirname, relative, resolve } from "path";

export interface ImportInfo {
  source: string;
  imports: string[];
  importedBy: string[];
}

export interface ImportGraph {
  files: Map<string, ImportInfo>;
  hubFiles: Array<{ file: string; importedByCount: number }>;
  circularDeps: Array<{ cycle: string[] }>;
  externalDeps: Map<string, number>; // package -> usage count
  unusedFiles: string[]; // Files that are never imported
}

const FILE_PATTERNS = [
  "src/**/*.{ts,tsx,js,jsx}",
  "app/**/*.{ts,tsx,js,jsx}",
  "components/**/*.{ts,tsx,js,jsx}",
  "lib/**/*.{ts,tsx,js,jsx}",
  "!**/*.test.*",
  "!**/*.spec.*",
  "!**/*.stories.*",
  "!**/node_modules/**",
];

export async function scanImports(dir: string): Promise<ImportGraph> {
  const files = await fg(FILE_PATTERNS, {
    cwd: dir,
    absolute: false,
  });

  const graph: Map<string, ImportInfo> = new Map();
  const externalDeps: Map<string, number> = new Map();

  // First pass: collect all imports
  for (const file of files) {
    const content = readFileSync(`${dir}/${file}`, "utf-8");
    const imports = extractImports(content, file, dir);

    graph.set(file, {
      source: file,
      imports: imports.internal,
      importedBy: [],
    });

    // Count external deps
    for (const ext of imports.external) {
      const pkg = ext.split("/")[0].startsWith("@")
        ? ext.split("/").slice(0, 2).join("/")
        : ext.split("/")[0];
      externalDeps.set(pkg, (externalDeps.get(pkg) || 0) + 1);
    }
  }

  // Second pass: build reverse lookup (importedBy)
  // Need to try multiple extensions since imports don't include them
  const extensions = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"];

  for (const [file, info] of graph) {
    for (const imp of info.imports) {
      // Try to find the actual file with various extensions
      let target = graph.get(imp);
      if (!target) {
        for (const ext of extensions) {
          target = graph.get(imp + ext);
          if (target) break;
        }
      }
      if (target) {
        target.importedBy.push(file);
      }
    }
  }

  // Find hub files (most imported)
  const hubFiles = Array.from(graph.entries())
    .map(([file, info]) => ({ file, importedByCount: info.importedBy.length }))
    .filter(h => h.importedByCount > 2)
    .sort((a, b) => b.importedByCount - a.importedByCount)
    .slice(0, 15);

  // Detect circular dependencies
  const circularDeps = findCircularDeps(graph);

  // Find unused files (components that are never imported)
  // Exclude entry points like page.tsx, layout.tsx, index.ts, route.ts
  const entryPointPatterns = [
    /page\.(tsx?|jsx?)$/,
    /layout\.(tsx?|jsx?)$/,
    /route\.(tsx?|jsx?)$/,
    /middleware\.(tsx?|jsx?)$/,
    /error\.(tsx?|jsx?)$/,
    /loading\.(tsx?|jsx?)$/,
    /not-found\.(tsx?|jsx?)$/,
    /^\/?index\.(tsx?|jsx?)$/,
    /\/index\.(tsx?|jsx?)$/,
  ];

  const unusedFiles = Array.from(graph.entries())
    .filter(([file, info]) => {
      // Skip if it's imported by other files
      if (info.importedBy.length > 0) return false;

      // Skip entry points
      if (entryPointPatterns.some(p => p.test(file))) return false;

      // Only include component files
      if (!file.includes("components/")) return false;

      return true;
    })
    .map(([file]) => file)
    .sort()
    .slice(0, 20); // Limit to 20

  return {
    files: graph,
    hubFiles,
    circularDeps,
    externalDeps,
    unusedFiles,
  };
}

function extractImports(content: string, file: string, dir: string): { internal: string[]; external: string[] } {
  const internal: string[] = [];
  const external: string[] = [];

  // Match import statements
  const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
  // Match require statements
  const requireRegex = /require\(['"]([^'"]+)['"]\)/g;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    categorizeImport(match[1], file, dir, internal, external);
  }
  while ((match = requireRegex.exec(content)) !== null) {
    categorizeImport(match[1], file, dir, internal, external);
  }

  return { internal: [...new Set(internal)], external: [...new Set(external)] };
}

function categorizeImport(
  importPath: string,
  file: string,
  dir: string,
  internal: string[],
  external: string[]
): void {
  // Skip node built-ins
  if (importPath.startsWith("node:")) return;

  // External package
  if (!importPath.startsWith(".") && !importPath.startsWith("@/") && !importPath.startsWith("~/")) {
    external.push(importPath);
    return;
  }

  // Resolve internal import
  let resolved: string;

  if (importPath.startsWith("@/")) {
    // Alias import @/ -> src/
    resolved = importPath.replace("@/", "src/");
  } else if (importPath.startsWith("~/")) {
    resolved = importPath.replace("~/", "");
  } else {
    // Relative import
    const fileDir = dirname(file);
    resolved = resolve(fileDir, importPath).replace(/\\/g, "/");
    // Remove leading ./
    if (resolved.startsWith("./")) resolved = resolved.slice(2);
  }

  // Try to find the actual file
  const extensions = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (internal.includes(candidate)) return;
    // We'll just store the resolved path, actual existence checked elsewhere
  }

  internal.push(resolved);
}

function findCircularDeps(graph: Map<string, ImportInfo>): Array<{ cycle: string[] }> {
  const cycles: Array<{ cycle: string[] }> = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const dfs = (file: string, path: string[]): void => {
    if (recursionStack.has(file)) {
      // Found cycle
      const cycleStart = path.indexOf(file);
      if (cycleStart !== -1) {
        const cycle = path.slice(cycleStart);
        // Only add if we haven't seen this cycle before
        const cycleKey = [...cycle].sort().join(":");
        if (!cycles.some(c => [...c.cycle].sort().join(":") === cycleKey)) {
          cycles.push({ cycle: [...cycle, file] });
        }
      }
      return;
    }

    if (visited.has(file)) return;

    visited.add(file);
    recursionStack.add(file);

    const info = graph.get(file);
    if (info) {
      for (const imp of info.imports) {
        dfs(imp, [...path, file]);
      }
    }

    recursionStack.delete(file);
  };

  for (const file of graph.keys()) {
    dfs(file, []);
  }

  return cycles.slice(0, 10); // Limit to 10 cycles
}

export function formatImportGraph(graph: ImportGraph): string {
  const lines: string[] = [];

  // Hub files section
  if (graph.hubFiles.length > 0) {
    lines.push("## Most Imported Files");
    lines.push("");
    lines.push("These files are imported most frequently - changes here have wide impact:");
    lines.push("");
    for (const hub of graph.hubFiles.slice(0, 10)) {
      lines.push(`- \`${hub.file}\` — imported by ${hub.importedByCount} files`);
    }
    lines.push("");
  }

  // Circular dependencies warning
  if (graph.circularDeps.length > 0) {
    lines.push("## ⚠️ Circular Dependencies");
    lines.push("");
    lines.push("**These circular imports may cause issues:**");
    lines.push("");
    for (const { cycle } of graph.circularDeps) {
      lines.push(`- ${cycle.map(f => `\`${basename(f)}\``).join(" → ")}`);
    }
    lines.push("");
  }

  // Unused components warning
  if (graph.unusedFiles && graph.unusedFiles.length > 0) {
    lines.push("## ⚠️ Potentially Unused Components");
    lines.push("");
    lines.push("These component files are never imported anywhere:");
    lines.push("");
    for (const file of graph.unusedFiles.slice(0, 10)) {
      lines.push(`- \`${file}\``);
    }
    if (graph.unusedFiles.length > 10) {
      lines.push(`- ... and ${graph.unusedFiles.length - 10} more`);
    }
    lines.push("");
    lines.push("*Consider removing these or they may be entry points not detected.*");
    lines.push("");
  }

  // Top external dependencies
  const topExternal = Array.from(graph.externalDeps.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  if (topExternal.length > 0) {
    lines.push("## Key Dependencies");
    lines.push("");
    lines.push("Most used external packages:");
    lines.push("");
    for (const [pkg, count] of topExternal) {
      lines.push(`- \`${pkg}\` — ${count} imports`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
