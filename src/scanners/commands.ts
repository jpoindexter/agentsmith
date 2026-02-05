import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface Commands {
  dev?: string;
  build?: string;
  test?: string;
  lint?: string;
  format?: string;
  typecheck?: string;
  db?: Record<string, string>;
  custom: Record<string, string>;
}

// Scripts that are typically important for AI to know about
const IMPORTANT_SCRIPTS = [
  "dev", "build", "start", "test", "lint", "format", "typecheck", "type-check",
  "db:push", "db:pull", "db:migrate", "db:seed", "db:studio", "db:reset",
  "ai:validate", "ai:lint", "ai:security", "validate", "setup",
];

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
