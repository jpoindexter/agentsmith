import { execSync } from "child_process";

export interface GitCommit {
  hash: string;
  date: string;
  author: string;
  message: string;
}

export interface GitInfo {
  commits: GitCommit[];
  branch: string;
  remoteUrl?: string;
}

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
