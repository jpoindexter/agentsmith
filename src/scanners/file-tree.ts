import fg from "fast-glob";
import { relative, dirname, basename } from "path";

export interface FileTreeNode {
  name: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
  fileCount?: number;
}

export interface FileTree {
  root: FileTreeNode;
  totalFiles: number;
  totalDirs: number;
}

const IGNORE_PATTERNS = [
  "node_modules/**",
  ".git/**",
  ".next/**",
  "dist/**",
  "build/**",
  ".turbo/**",
  "coverage/**",
  ".cache/**",
  "*.lock",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
];

// Key directories to always show expanded
const KEY_DIRS = [
  "src",
  "app",
  "components",
  "lib",
  "hooks",
  "utils",
  "api",
  "pages",
  "styles",
  "config",
  "types",
  "services",
  "providers",
];

export async function scanFileTree(dir: string, maxDepth: number = 3): Promise<FileTree> {
  const files = await fg(["**/*"], {
    cwd: dir,
    ignore: IGNORE_PATTERNS,
    onlyFiles: true,
    deep: maxDepth + 2,
  });

  const tree: FileTreeNode = {
    name: basename(dir) || "root",
    type: "directory",
    children: [],
  };

  const dirMap = new Map<string, FileTreeNode>();
  dirMap.set("", tree);

  let totalDirs = 0;

  for (const file of files) {
    const parts = file.split("/");
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!dirMap.has(currentPath)) {
        const node: FileTreeNode = {
          name: part,
          type: isFile ? "file" : "directory",
          ...(isFile ? {} : { children: [], fileCount: 0 }),
        };

        const parent = dirMap.get(parentPath);
        if (parent && parent.children) {
          parent.children.push(node);
        }

        if (!isFile) {
          dirMap.set(currentPath, node);
          totalDirs++;
        }
      }

      // Increment file count for parent directories
      if (isFile) {
        let p = parentPath;
        while (p !== undefined) {
          const parentNode = dirMap.get(p);
          if (parentNode && parentNode.fileCount !== undefined) {
            parentNode.fileCount++;
          }
          const lastSlash = p.lastIndexOf("/");
          p = lastSlash > 0 ? p.slice(0, lastSlash) : (p === "" ? undefined! : "");
        }
      }
    }
  }

  // Sort children: directories first, then files, alphabetically
  const sortChildren = (node: FileTreeNode) => {
    if (node.children) {
      node.children.sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortChildren);
    }
  };
  sortChildren(tree);

  return {
    root: tree,
    totalFiles: files.length,
    totalDirs,
  };
}

export function formatFileTree(tree: FileTree, maxDepth: number = 3): string {
  const lines: string[] = ["## Project Structure", ""];

  const renderNode = (node: FileTreeNode, prefix: string = "", depth: number = 0) => {
    if (depth > maxDepth) return;

    const isKeyDir = KEY_DIRS.includes(node.name.toLowerCase());
    const showExpanded = depth < 2 || isKeyDir;

    if (node.type === "directory") {
      const fileCount = node.fileCount ? ` (${node.fileCount} files)` : "";
      lines.push(`${prefix}${node.name}/${fileCount}`);

      if (node.children && showExpanded) {
        const filteredChildren = node.children.filter(child => {
          // Always show directories, filter out non-essential files at deeper levels
          if (child.type === "directory") return true;
          if (depth < 2) return true;
          // At deeper levels, only show key files
          return /\.(ts|tsx|js|jsx|json|md)$/.test(child.name) &&
                 !child.name.includes(".test.") &&
                 !child.name.includes(".spec.");
        });

        filteredChildren.forEach((child, i) => {
          const isLast = i === filteredChildren.length - 1;
          const connector = isLast ? "└── " : "├── ";
          const newPrefix = prefix + (isLast ? "    " : "│   ");

          if (child.type === "file") {
            lines.push(`${prefix}${connector}${child.name}`);
          } else {
            renderNode(child, prefix + connector.replace("── ", ""), depth + 1);
          }
        });
      }
    }
  };

  if (tree.root.children) {
    tree.root.children.forEach(child => {
      renderNode(child, "", 0);
    });
  }

  lines.push("");
  lines.push(`*${tree.totalFiles} files across ${tree.totalDirs} directories*`);
  lines.push("");

  return lines.join("\n");
}
