/**
 * Complexity Analyzer
 *
 * Analyzes codebase complexity to recommend AI model/effort settings.
 * Categorizes files and areas as high/medium/low complexity.
 *
 * @module scanners/complexity
 */

import fg from "fast-glob";
import { readFileSync } from "fs";

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

/** AI configuration recommendations */
export interface AIRecommendations {
  /** Recommended model for simple tasks */
  simpleModel: "haiku" | "sonnet";
  /** Recommended model for complex tasks */
  complexModel: "sonnet" | "opus";
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
    const complexity = analyzeFile(`${dir}/${file}`, file);
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

  // Generate recommendations
  const extendedThinkingRecommended = avgComplexity > 40 || complexFiles[0]?.score > 60;

  return {
    simpleModel: avgComplexity > 30 ? "sonnet" : "haiku",
    complexModel: avgComplexity > 50 ? "opus" : "sonnet",
    extendedThinkingRecommended,
    areas,
    complexFiles,
  };
}

/**
 * Analyzes individual file complexity
 */
function analyzeFile(fullPath: string, relativePath: string): FileComplexity | null {
  try {
    const content = readFileSync(fullPath, "utf-8");
    const lines = content.split("\n").length;

    const reasons: string[] = [];
    let score = 0;

    // Base score from lines
    if (lines > 500) {
      score += 30;
      reasons.push("large file (>500 lines)");
    } else if (lines > 200) {
      score += 15;
      reasons.push("moderate size (>200 lines)");
    }

    // Nested complexity (deep nesting)
    const maxNesting = calculateMaxNesting(content);
    if (maxNesting > 5) {
      score += 25;
      reasons.push("deep nesting");
    } else if (maxNesting > 3) {
      score += 10;
    }

    // Async/Promise complexity
    const asyncCount = (content.match(/async|await|Promise/g) || []).length;
    if (asyncCount > 20) {
      score += 20;
      reasons.push("heavy async logic");
    } else if (asyncCount > 10) {
      score += 10;
    }

    // RegExp complexity
    const regexCount = (content.match(/\/[^/]+\/[gimuy]*/g) || []).length;
    if (regexCount > 10) {
      score += 15;
      reasons.push("complex regex patterns");
    }

    // Type complexity (generics, unions)
    const genericCount = (content.match(/<[A-Z][^>]*>/g) || []).length;
    const unionCount = (content.match(/\|/g) || []).length;
    if (genericCount + unionCount > 30) {
      score += 15;
      reasons.push("complex types");
    }

    // Error handling
    const tryCount = (content.match(/try\s*\{/g) || []).length;
    if (tryCount > 5) {
      score += 10;
      reasons.push("extensive error handling");
    }

    // Database/ORM complexity
    if (
      content.includes("prisma") ||
      content.includes("drizzle") ||
      content.includes("query")
    ) {
      score += 10;
      if (content.match(/\.(findMany|findUnique|create|update|delete)/g)?.length > 5) {
        reasons.push("database operations");
      }
    }

    // Determine level
    let level: ComplexityLevel = "low";
    if (score > 50) level = "high";
    else if (score > 25) level = "medium";

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
 * Calculates maximum nesting depth in code
 */
function calculateMaxNesting(content: string): number {
  let max = 0;
  let current = 0;

  for (const char of content) {
    if (char === "{" || char === "(") {
      current++;
      if (current > max) max = current;
    } else if (char === "}" || char === ")") {
      current--;
    }
  }

  return max;
}

/**
 * Categorizes files by area (API, Components, etc.)
 */
function categorizeByArea(files: FileComplexity[]): AreaComplexity[] {
  const areas = new Map<string, FileComplexity[]>();

  for (const file of files) {
    let areaName = "Other";

    if (file.path.includes("/api/") || file.path.includes("/pages/api/")) {
      areaName = "API Routes";
    } else if (
      file.path.includes("/components/") ||
      file.path.match(/\.tsx$/)
    ) {
      areaName = "Components";
    } else if (file.path.includes("/lib/") || file.path.includes("/utils/")) {
      areaName = "Utilities";
    } else if (file.path.includes("/hooks/")) {
      areaName = "Hooks";
    } else if (file.path.includes("prisma") || file.path.includes("/db/")) {
      areaName = "Database";
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
    if (avgScore > 40) level = "high";
    else if (avgScore > 20) level = "medium";

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
