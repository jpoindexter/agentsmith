/**
 * Git Scanner
 *
 * Extracts git information from the repository:
 * - Recent commit history
 * - Current branch
 * - Remote URL
 * - Uncommitted changes (diff)
 *
 * @module scanners/git
 */

import { execSync } from "child_process";

/** Git commit information */
export interface GitCommit {
  /** Short commit hash (7 chars) */
  hash: string;
  /** Commit date (YYYY-MM-DD) */
  date: string;
  /** Author name */
  author: string;
  /** Commit message (truncated to 80 chars) */
  message: string;
}

/** Git repository information */
export interface GitInfo {
  /** Recent commits */
  commits: GitCommit[];
  /** Current branch name */
  branch: string;
  /** Remote origin URL if configured */
  remoteUrl?: string;
}

/**
 * Scans git log for recent commits
 *
 * @param dir - Project root directory
 * @param limit - Maximum number of commits to retrieve
 * @returns Git info or null if not a git repository
 *
 * @example
 * const git = scanGitLog('/path/to/project', 5);
 * if (git) console.log(`On branch ${git.branch}`);
 */
export function scanGitLog(dir: string, limit: number = 10): GitInfo | null {
  try {
    // Check if it's a git repo
    execSync("git rev-parse --is-inside-work-tree", { cwd: dir, stdio: "pipe" });
  } catch {
    return null;
  }

  try {
    // Get current branch
    let branch = "main";
    try {
      branch = execSync("git branch --show-current", { cwd: dir, encoding: "utf-8" }).trim();
    } catch {
      // Fallback for detached HEAD
      branch = "HEAD";
    }

    // Get remote URL
    let remoteUrl: string | undefined;
    try {
      remoteUrl = execSync("git remote get-url origin", { cwd: dir, encoding: "utf-8" }).trim();
    } catch {
      // No remote configured
    }

    // Get recent commits
    const logFormat = "%H|%ad|%an|%s";
    const logOutput = execSync(
      `git log -${limit} --pretty=format:"${logFormat}" --date=short`,
      { cwd: dir, encoding: "utf-8" }
    );

    const commits: GitCommit[] = logOutput
      .split("\n")
      .filter(Boolean)
      .map(line => {
        const [hash, date, author, ...messageParts] = line.split("|");
        return {
          hash: hash.slice(0, 7),
          date,
          author,
          message: messageParts.join("|").slice(0, 80),
        };
      });

    return { commits, branch, remoteUrl };
  } catch {
    return null;
  }
}

/**
 * Gets uncommitted changes as a diff
 *
 * @param dir - Project root directory
 * @returns Diff string or null if no changes or not a git repo
 */
export function getGitDiff(dir: string): string | null {
  try {
    // Check if it's a git repo
    execSync("git rev-parse --is-inside-work-tree", { cwd: dir, stdio: "pipe" });

    // Get staged and unstaged changes
    const diff = execSync("git diff HEAD", { cwd: dir, encoding: "utf-8" });
    return diff.trim() || null;
  } catch {
    return null;
  }
}

/** Formats git diff as markdown code block */
export function formatGitDiff(diff: string): string {
  if (!diff) return "";

  const lines = [
    "## Uncommitted Changes",
    "",
    "```diff",
    diff.slice(0, 5000), // Limit to 5KB to avoid huge outputs
  ];

  if (diff.length > 5000) {
    lines.push(`... (${((diff.length - 5000) / 1024).toFixed(1)}KB more)`);
  }

  lines.push("```");
  lines.push("");

  return lines.join("\n");
}

/** Formats git log as markdown documentation */
export function formatGitLog(gitInfo: GitInfo): string {
  if (!gitInfo || gitInfo.commits.length === 0) return "";

  const lines = [
    "## Recent Changes",
    "",
    `Branch: \`${gitInfo.branch}\``,
    "",
  ];

  if (gitInfo.remoteUrl) {
    lines.push(`Remote: ${gitInfo.remoteUrl}`);
    lines.push("");
  }

  lines.push("### Recent Commits");
  lines.push("");

  for (const commit of gitInfo.commits) {
    lines.push(`- \`${commit.hash}\` ${commit.message} *(${commit.date})*`);
  }

  lines.push("");

  return lines.join("\n");
}
