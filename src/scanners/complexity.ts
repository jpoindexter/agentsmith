/**
 * Complexity Analyzer
 *
 * Analyzes codebase complexity to recommend AI model/effort settings.
 * Uses multiple metrics: cyclomatic complexity, git churn, coupling, and size.
 *
 * @module scanners/complexity
 */

import fg from "fast-glob";
import { readFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { escapeShellPath } from "../utils/shell.js";

/** Complexity level for files or sections */
export type ComplexityLevel = "low" | "medium" | "high";

/** File complexity information */
export interface FileComplexity {
  /** File path */
  path: string;
  /** Lines of code */
  lines: number;
  /** Complexity score (0-100) */
  score: number;
  /** Complexity level */
  level: ComplexityLevel;
  /** Reasons for complexity */
  reasons: string[];
}

/** Area-based complexity (e.g., "API Routes", "Components") */
export interface AreaComplexity {
  /** Area name */
  name: string;
  /** Complexity level */
  level: ComplexityLevel;
  /** File count */
  fileCount: number;
  /** Average complexity score */
  avgScore: number;
  /** Characteristics */
  characteristics: string[];
}

/** AI effort/resource tier for provider-agnostic recommendations */
export type ModelTier = "minimal" | "standard" | "maximum";

/** AI configuration recommendations */
export interface AIRecommendations {
  /** Recommended model tier for simple tasks */
  simpleModel: ModelTier;
  /** Recommended model tier for complex tasks */
  complexModel: ModelTier;
  /** Whether to enable extended thinking */
  extendedThinkingRecommended: boolean;
  /** Areas categorized by complexity */
  areas: AreaComplexity[];
  /** Most complex files */
  complexFiles: FileComplexity[];
}

/**
 * Analyzes codebase complexity and generates AI recommendations
 */
export async function analyzeComplexity(dir: string): Promise<AIRecommendations> {
  const files = await fg(
    [
      "**/*.{ts,tsx,js,jsx}",
      "!**/node_modules/**",
      "!**/.next/**",
      "!**/dist/**",
      "!**/build/**",
      "!**/.git/**",
    ],
    { cwd: dir, absolute: false }
  );

  const fileComplexities: FileComplexity[] = [];

  for (const file of files) {
    const complexity = analyzeFile(`${dir}/${file}`, file, dir);
    if (complexity) {
      fileComplexities.push(complexity);
    }
  }

  // Categorize by area
  const areas = categorizeByArea(fileComplexities);

  // Get most complex files (top 10)
  const complexFiles = fileComplexities
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  // Calculate overall complexity
  const avgComplexity =
    fileComplexities.reduce((sum, f) => sum + f.score, 0) / fileComplexities.length;

  // Generate recommendations based on improved scoring
  const extendedThinkingRecommended = avgComplexity > 35 || complexFiles[0]?.score > 55;

  return {
    simpleModel: avgComplexity > 25 ? "standard" : "minimal",
    complexModel: avgComplexity > 45 ? "maximum" : "standard",
    extendedThinkingRecommended,
    areas,
    complexFiles,
  };
}

/**
 * Analyzes individual file complexity using multiple metrics
 */
function analyzeFile(fullPath: string, relativePath: string, dir: string): FileComplexity | null {
  try {
    const content = readFileSync(fullPath, "utf-8");
    const lines = content.split("\n").length;

    const reasons: string[] = [];
    let score = 0;

    // 1. SIZE COMPLEXITY (max 20 points)
    if (lines > 500) {
      score += 20;
      reasons.push("large file (>500 lines)");
    } else if (lines > 300) {
      score += 12;
      reasons.push("moderately large (>300 lines)");
    } else if (lines > 150) {
      score += 6;
    }

    // 2. COGNITIVE COMPLEXITY (max 30 points) - Primary metric
    // Research shows cognitive > cyclomatic for measuring mental effort
    const cognitiveComplexity = calculateCognitiveComplexity(content);
    if (cognitiveComplexity > 50) {
      score += 30;
      reasons.push("high cognitive complexity");
    } else if (cognitiveComplexity > 25) {
      score += 20;
      reasons.push("moderate cognitive complexity");
    } else if (cognitiveComplexity > 10) {
      score += 10;
    }

    // Keep cyclomatic as secondary metric (no longer adds to score, just for reference)
    const cyclomaticComplexity = calculateCyclomaticComplexity(content);

    // 3. GIT CHURN (max 15 points) - frequently changed files need more attention
    const churn = calculateGitChurn(relativePath, dir);
    if (churn > 50) {
      score += 15;
      reasons.push("frequently modified (hot spot)");
    } else if (churn > 20) {
      score += 10;
      reasons.push("moderate change frequency");
    } else if (churn > 10) {
      score += 5;
    }

    // 4. COUPLING (max 15 points) - high coupling increases complexity
    const coupling = calculateCoupling(content);
    if (coupling > 30) {
      score += 15;
      reasons.push("high coupling (many imports)");
    } else if (coupling > 15) {
      score += 10;
      reasons.push("moderate coupling");
    } else if (coupling > 8) {
      score += 5;
    }

    // 5. ASYNC COMPLEXITY (max 10 points)
    const asyncCount = (content.match(/async|await|Promise/g) || []).length;
    if (asyncCount > 20) {
      score += 10;
      reasons.push("heavy async logic");
    } else if (asyncCount > 10) {
      score += 5;
    }

    // 6. REGEX COMPLEXITY (max 10 points)
    const regexCount = (content.match(/\/[^/]+\/[gimuy]*/g) || []).length;
    if (regexCount > 10) {
      score += 10;
      reasons.push("complex regex patterns");
    } else if (regexCount > 5) {
      score += 5;
    }

    // 7. TYPE COMPLEXITY (max 5 points)
    const genericCount = (content.match(/<[A-Z][^>]*>/g) || []).length;
    const unionCount = (content.match(/\|/g) || []).length;
    if (genericCount + unionCount > 40) {
      score += 5;
      reasons.push("complex types");
    }

    // Determine level
    let level: ComplexityLevel = "low";
    if (score > 50) level = "high";
    else if (score > 30) level = "medium";

    return {
      path: relativePath,
      lines,
      score: Math.min(score, 100),
      level,
      reasons,
    };
  } catch {
    return null;
  }
}

/**
 * Calculates cyclomatic complexity (decision points)
 * Counts: if/else, loops, case, ternary, logical operators
 */
function calculateCyclomaticComplexity(content: string): number {
  let complexity = 1; // Base complexity

  // Control flow statements
  const ifCount = (content.match(/\bif\s*\(/g) || []).length;
  const elseCount = (content.match(/\belse\b/g) || []).length;
  const forCount = (content.match(/\bfor\s*\(/g) || []).length;
  const whileCount = (content.match(/\bwhile\s*\(/g) || []).length;
  const caseCount = (content.match(/\bcase\s+/g) || []).length;
  const catchCount = (content.match(/\bcatch\s*\(/g) || []).length;

  // Logical operators (each adds a decision point)
  const andOrCount = (content.match(/(\&\&|\|\|)/g) || []).length;
  const ternaryCount = (content.match(/\?[^:]+:/g) || []).length;

  complexity += ifCount + elseCount + forCount + whileCount + caseCount + catchCount;
  complexity += andOrCount + ternaryCount;

  return complexity;
}

/**
 * Calculates cognitive complexity (mental effort to understand code)
 * Based on Sonar's Cognitive Complexity algorithm
 * Measures: nesting depth, interruptions, recursion
 *
 * Research: https://www.sonarsource.com/resources/white-papers/cognitive-complexity/
 */
function calculateCognitiveComplexity(content: string): number {
  let complexity = 0;
  let nestingLevel = 0;
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.length === 0) {
      continue;
    }

    // Detect nesting increases
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;

    // Count control structures with nesting penalty
    if (/\bif\s*\(/.test(line)) {
      complexity += 1 + nestingLevel; // +1 for if, +nestingLevel for being nested
    }
    if (/\belse\b/.test(line)) {
      complexity += 1;
    }
    if (/\bfor\s*\(/.test(line) || /\bwhile\s*\(/.test(line) || /\bdo\s*\{/.test(line)) {
      complexity += 1 + nestingLevel;
    }
    if (/\bcase\s+/.test(line)) {
      complexity += 1 + nestingLevel;
    }
    if (/\bcatch\s*\(/.test(line)) {
      complexity += 1 + nestingLevel;
    }

    // Logical operators in conditions (break readability)
    if (/\bif\s*\([^)]*(\&\&|\|\|)/.test(line)) {
      const operators = (line.match(/(\&\&|\|\|)/g) || []).length;
      complexity += operators;
    }

    // Interruptions (break, continue, return in middle of function)
    if (nestingLevel > 0 && /\b(break|continue)\b/.test(trimmed)) {
      complexity += 1;
    }

    // Recursion (function calling itself)
    const funcMatch = line.match(/function\s+(\w+)\s*\(/);
    if (funcMatch) {
      const funcName = funcMatch[1];
      // Check if this function is called in its own body (simple recursion detection)
      const funcBody = lines.slice(i).join('\n').split(/^function\s+\w+\s*\(/m)[0];
      if (funcBody && funcBody.includes(`${funcName}(`)) {
        complexity += 2; // Recursion is harder to understand
      }
    }

    // Update nesting level
    nestingLevel += openBraces - closeBraces;
    if (nestingLevel < 0) nestingLevel = 0; // Safety check
  }

  return complexity;
}

/**
 * Calculates git churn (number of times file changed)
 * Returns 0 if not in a git repo or file not tracked
 */
function calculateGitChurn(relativePath: string, dir: string): number {
  try {
    if (!existsSync(`${dir}/.git`)) return 0;

    // Sanitize path to prevent command injection
    const safePath = escapeShellPath(relativePath);
    const result = execSync(`git log --oneline --follow -- ${safePath} | wc -l`, {
      cwd: dir,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"], // Suppress stderr
    });

    return parseInt(result.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Calculates coupling (number of imports)
 */
function calculateCoupling(content: string): number {
  const importCount = (content.match(/^import\s+/gm) || []).length;
  const requireCount = (content.match(/require\s*\(/g) || []).length;
  return importCount + requireCount;
}

/**
 * Categorizes files by area with better categorization
 */
function categorizeByArea(files: FileComplexity[]): AreaComplexity[] {
  const areas = new Map<string, FileComplexity[]>();

  for (const file of files) {
    let areaName = "Source Files"; // Default instead of "Other"

    // Check in priority order (most specific first)
    if (file.path.includes("/api/") || file.path.includes("/pages/api/") || file.path.includes("/app/api/")) {
      areaName = "API Routes";
    } else if (file.path.includes("/hooks/") || file.path.startsWith("use")) {
      areaName = "Hooks";
    } else if (file.path.includes("prisma") || file.path.includes("/db/") || file.path.includes("database")) {
      areaName = "Database";
    } else if (file.path.includes("/components/") || file.path.includes("/ui/")) {
      areaName = "Components";
    } else if (file.path.match(/\.tsx$/)) {
      areaName = "Pages/Routes";
    } else if (file.path.includes("/lib/") || file.path.includes("/utils/")) {
      areaName = "Utilities";
    } else if (file.path.includes("/types/") || file.path.includes("types.ts")) {
      areaName = "Type Definitions";
    } else if (file.path.includes("/actions/") || file.path.includes("/mutations/")) {
      areaName = "Server Actions";
    } else if (file.path.includes("/config/") || file.path.includes(".config.")) {
      areaName = "Configuration";
    } else if (file.path.includes("/scanners/") || file.path.includes("/parsers/")) {
      areaName = "Scanners/Parsers";
    }

    if (!areas.has(areaName)) {
      areas.set(areaName, []);
    }
    areas.get(areaName)!.push(file);
  }

  const result: AreaComplexity[] = [];

  for (const [name, areaFiles] of areas) {
    const avgScore =
      areaFiles.reduce((sum, f) => sum + f.score, 0) / areaFiles.length;

    let level: ComplexityLevel = "low";
    if (avgScore > 45) level = "high";
    else if (avgScore > 30) level = "medium";

    const characteristics: string[] = [];
    const reasonCounts = new Map<string, number>();

    areaFiles.forEach((f) => {
      f.reasons.forEach((r) => {
        reasonCounts.set(r, (reasonCounts.get(r) || 0) + 1);
      });
    });

    // Top 3 characteristics
    const topReasons = Array.from(reasonCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([reason]) => reason);

    characteristics.push(...topReasons);

    result.push({
      name,
      level,
      fileCount: areaFiles.length,
      avgScore: Math.round(avgScore),
      characteristics,
    });
  }

  return result.sort((a, b) => b.avgScore - a.avgScore);
}
