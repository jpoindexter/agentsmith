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
  lines.push("```");

  const renderChildren = (children: FileTreeNode[], prefix: string, depth: number) => {
    if (depth > maxDepth) return;

    // Filter children based on depth
    const filteredChildren = children.filter(child => {
      if (child.type === "directory") return true;
      if (depth < 2) return true;
      // At deeper levels, only show key files
      return /\.(ts|tsx|js|jsx|json)$/.test(child.name) &&
             !child.name.includes(".test.") &&
             !child.name.includes(".spec.") &&
             !child.name.includes(".stories.");
    });

    // Limit files shown per directory
    const maxFilesPerDir = 8;
    let filesShown = 0;
    let hiddenFiles = 0;

    filteredChildren.forEach((child, i) => {
      const isLast = i === filteredChildren.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const childPrefix = prefix + (isLast ? "    " : "│   ");

      if (child.type === "directory") {
        const isKeyDir = KEY_DIRS.includes(child.name.toLowerCase());
        const shouldExpand = depth < 2 || isKeyDir;
        const fileCount = child.fileCount ? ` (${child.fileCount})` : "";

        lines.push(`${prefix}${connector}${child.name}/${fileCount}`);

        if (shouldExpand && child.children && child.children.length > 0) {
          renderChildren(child.children, childPrefix, depth + 1);
        }
      } else {
        // It's a file
        if (filesShown < maxFilesPerDir) {
          lines.push(`${prefix}${connector}${child.name}`);
          filesShown++;
        } else {
          hiddenFiles++;
        }
      }
    });

    // Show hidden files count
    if (hiddenFiles > 0) {
      const connector = "└── ";
      lines.push(`${prefix}${connector}... ${hiddenFiles} more files`);
    }
  };

  if (tree.root.children) {
    renderChildren(tree.root.children, "", 0);
  }

  lines.push("```");
  lines.push("");

  return lines.join("\n");
}
