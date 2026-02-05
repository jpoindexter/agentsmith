/**
 * Security Audit Scanner
 *
 * Performs security analysis using npm audit:
 * - Vulnerability detection by severity (critical, high, moderate, low)
 * - Outdated package detection
 * - Lockfile verification
 *
 * @module scanners/security
 */

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

/** Security audit results */
export interface SecurityAudit {
  /** Vulnerability counts by severity */
  vulnerabilities: {
    critical: number;
    high: number;
    moderate: number;
    low: number;
    info: number;
    total: number;
  };
  /** Packages with newer versions available */
  outdatedPackages: Array<{
    name: string;
    current: string;
    wanted: string;
    latest: string;
  }>;
  /** Whether a package lockfile exists */
  hasLockfile: boolean;
  /** Error message if audit failed */
  auditError?: string;
}

/**
 * Runs npm audit and checks for outdated packages
 *
 * @param dir - Project root directory
 * @returns Security audit results or null if no package.json
 *
 * @example
 * const audit = await scanSecurity('/path/to/project');
 * if (audit?.vulnerabilities.critical > 0) {
 *   console.warn('Critical vulnerabilities found!');
 * }
 */
export async function scanSecurity(dir: string): Promise<SecurityAudit | null> {
  // Check if package.json exists
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) {
    return null;
  }

  // Check for lockfile
  const hasLockfile =
    existsSync(join(dir, "package-lock.json")) ||
    existsSync(join(dir, "yarn.lock")) ||
    existsSync(join(dir, "pnpm-lock.yaml"));

  const result: SecurityAudit = {
    vulnerabilities: {
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
      info: 0,
      total: 0,
    },
    outdatedPackages: [],
    hasLockfile,
  };

  // Run npm audit
  try {
    // npm audit returns non-zero exit code when vulnerabilities found
    const auditOutput = execSync("npm audit --json 2>/dev/null", {
      cwd: dir,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
    });

    const audit = JSON.parse(auditOutput);

    if (audit.metadata?.vulnerabilities) {
      const v = audit.metadata.vulnerabilities;
      result.vulnerabilities = {
        critical: v.critical || 0,
        high: v.high || 0,
        moderate: v.moderate || 0,
        low: v.low || 0,
        info: v.info || 0,
        total: v.total || 0,
      };
    }
  } catch (error) {
    // npm audit returns exit code 1 when vulnerabilities found
    // Try to parse the output anyway
    if (error instanceof Error && "stdout" in error) {
      try {
        const audit = JSON.parse((error as { stdout: string }).stdout);
        if (audit.metadata?.vulnerabilities) {
          const v = audit.metadata.vulnerabilities;
          result.vulnerabilities = {
            critical: v.critical || 0,
            high: v.high || 0,
            moderate: v.moderate || 0,
            low: v.low || 0,
            info: v.info || 0,
            total: v.total || 0,
          };
        }
      } catch {
        // Could not parse audit output
        result.auditError = "Could not run npm audit";
      }
    } else {
      result.auditError = "Could not run npm audit";
    }
  }

  // Check for outdated packages (quick check, limited to direct deps)
  try {
    const outdatedOutput = execSync("npm outdated --json 2>/dev/null || true", {
      cwd: dir,
      encoding: "utf-8",
      timeout: 30000, // 30 second timeout
    });

    if (outdatedOutput.trim()) {
      const outdated = JSON.parse(outdatedOutput);
      for (const [name, info] of Object.entries(outdated)) {
        const pkg = info as { current?: string; wanted?: string; latest?: string };
        if (pkg.current && pkg.latest && pkg.current !== pkg.latest) {
          result.outdatedPackages.push({
            name,
            current: pkg.current,
            wanted: pkg.wanted || pkg.current,
            latest: pkg.latest,
          });
        }
      }
      // Sort by name, limit to most important
      result.outdatedPackages = result.outdatedPackages
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 20);
    }
  } catch {
    // npm outdated failed, skip
  }

  return result;
}

/** Formats security audit results as markdown documentation */
export function formatSecurityAudit(audit: SecurityAudit): string {
  const lines: string[] = [];

  lines.push("## Security");
  lines.push("");

  const v = audit.vulnerabilities;
  if (v.total > 0) {
    lines.push("### Vulnerabilities");
    lines.push("");
    lines.push("| Severity | Count |");
    lines.push("|----------|-------|");
    if (v.critical > 0) lines.push(`| 🔴 Critical | ${v.critical} |`);
    if (v.high > 0) lines.push(`| 🟠 High | ${v.high} |`);
    if (v.moderate > 0) lines.push(`| 🟡 Moderate | ${v.moderate} |`);
    if (v.low > 0) lines.push(`| 🟢 Low | ${v.low} |`);
    lines.push("");
    lines.push("Run `npm audit` for details and `npm audit fix` to resolve.");
    lines.push("");
  } else if (!audit.auditError) {
    lines.push("✅ No known vulnerabilities found.");
    lines.push("");
  }

  if (audit.outdatedPackages.length > 0) {
    lines.push("### Outdated Packages");
    lines.push("");
    lines.push("| Package | Current | Latest |");
    lines.push("|---------|---------|--------|");
    for (const pkg of audit.outdatedPackages.slice(0, 10)) {
      lines.push(`| ${pkg.name} | ${pkg.current} | ${pkg.latest} |`);
    }
    if (audit.outdatedPackages.length > 10) {
      lines.push(`| ... | +${audit.outdatedPackages.length - 10} more | |`);
    }
    lines.push("");
  }

  if (audit.auditError) {
    lines.push(`⚠️ ${audit.auditError}`);
    lines.push("");
  }

  return lines.join("\n");
}
