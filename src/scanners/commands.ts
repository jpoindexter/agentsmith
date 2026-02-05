/**
 * npm Scripts Scanner
 *
 * Extracts important npm scripts from package.json.
 * Categorizes scripts into common groups (dev, build, test, db, etc.)
 * for easy reference in AGENTS.md output.
 *
 * @module scanners/commands
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

/** npm scripts organized by category */
export interface Commands {
  /** Development server command */
  dev?: string;
  /** Production build command */
  build?: string;
  /** Test runner command */
  test?: string;
  /** Linting command */
  lint?: string;
  /** Code formatting command */
  format?: string;
  /** TypeScript type checking command */
  typecheck?: string;
  /** Database-related commands */
  db?: Record<string, string>;
  /** Other important custom commands */
  custom: Record<string, string>;
}

/** Scripts considered important for AI documentation */
const IMPORTANT_SCRIPTS = [
  "dev", "build", "start", "test", "lint", "format", "typecheck", "type-check",
  "db:push", "db:pull", "db:migrate", "db:seed", "db:studio", "db:reset",
  "ai:validate", "ai:lint", "ai:security", "validate", "setup",
];

/**
 * Scans package.json for npm scripts
 *
 * @param dir - Project root directory
 * @returns Categorized npm commands
 */
export async function scanCommands(dir: string): Promise<Commands> {
  const commands: Commands = {
    custom: {},
  };

  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) {
    return commands;
  }

  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  const scripts = pkg.scripts || {};

  for (const [name, script] of Object.entries(scripts)) {
    const scriptStr = String(script);

    // Categorize scripts
    if (name === "dev") {
      commands.dev = scriptStr;
    } else if (name === "build") {
      commands.build = scriptStr;
    } else if (name === "test" || name === "test:unit") {
      commands.test = scriptStr;
    } else if (name === "lint") {
      commands.lint = scriptStr;
    } else if (name === "format") {
      commands.format = scriptStr;
    } else if (name === "typecheck" || name === "type-check") {
      commands.typecheck = scriptStr;
    } else if (name.startsWith("db:")) {
      if (!commands.db) commands.db = {};
      commands.db[name] = scriptStr;
    } else if (IMPORTANT_SCRIPTS.includes(name) || name.startsWith("ai:") || name.startsWith("validate")) {
      commands.custom[name] = scriptStr;
    }
  }

  return commands;
}
