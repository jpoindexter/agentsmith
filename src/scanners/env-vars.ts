import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface EnvVar {
  name: string;
  required: boolean;
  hasDefault: boolean;
  description?: string;
  category?: string;
}

export async function scanEnvVars(dir: string): Promise<EnvVar[]> {
  const envVars: EnvVar[] = [];
  const seenVars = new Set<string>();

  // 1. Check .env.example or .env.local.example
  const exampleFiles = [".env.example", ".env.local.example", ".env.sample"];
  for (const exampleFile of exampleFiles) {
    const path = join(dir, exampleFile);
    if (existsSync(path)) {
      const content = readFileSync(path, "utf-8");
      parseEnvExample(content, envVars, seenVars);
      break;
    }
  }

  // 2. Check for Zod validation schema
  const validationPaths = [
    "src/lib/env/validation.ts",
    "src/lib/env/index.ts",
    "src/env.ts",
    "lib/env.ts",
  ];

  for (const valPath of validationPaths) {
    const path = join(dir, valPath);
    if (existsSync(path)) {
      const content = readFileSync(path, "utf-8");
      parseZodValidation(content, envVars, seenVars);
      break;
    }
  }

  // 3. Scan source files for process.env usage
  // (This is expensive so we skip it for now)

  return envVars;
}

function parseEnvExample(content: string, envVars: EnvVar[], seenVars: Set<string>): void {
  const lines = content.split("\n");
  let currentCategory: string | undefined;

  for (const line of lines) {
    // Detect category comments
    const categoryMatch = line.match(/^#\s*[-=]+\s*(.+?)\s*[-=]*$/i) ||
                          line.match(/^#\s*\[(.+?)\]/) ||
                          line.match(/^#\s*(.+):?\s*$/);

    if (categoryMatch && !line.includes("=")) {
      const cat = categoryMatch[1].trim();
      if (cat.length > 2 && cat.length < 50) {
        currentCategory = cat;
      }
      continue;
    }

    // Parse env var
    const varMatch = line.match(/^([A-Z][A-Z0-9_]+)\s*=\s*(.*)$/);
    if (varMatch && !seenVars.has(varMatch[1])) {
      const name = varMatch[1];
      const value = varMatch[2];

      seenVars.add(name);
      envVars.push({
        name,
        required: !value || value === '""' || value === "''",
        hasDefault: !!value && value !== '""' && value !== "''",
        category: currentCategory,
      });
    }
  }
}

function parseZodValidation(content: string, envVars: EnvVar[], seenVars: Set<string>): void {
  // Look for z.string() patterns with env var names
  const patterns = [
    // z.string() with optional()
    /([A-Z][A-Z0-9_]+)\s*:\s*z\.string\(\)(?:\.min\([^)]+\))?(?:\.optional\(\))/g,
    // z.string() required
    /([A-Z][A-Z0-9_]+)\s*:\s*z\.string\(\)(?:\.min\([^)]+\))?(?!\.optional)/g,
    // env.* access
    /env\.([A-Z][A-Z0-9_]+)/g,
    // process.env.*
    /process\.env\.([A-Z][A-Z0-9_]+)/g,
  ];

  for (const pattern of patterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const name = match[1];
      if (!seenVars.has(name)) {
        seenVars.add(name);

        // Determine if required based on pattern
        const isOptional = content.includes(`${name}: z.string().optional()`) ||
                          content.includes(`${name}: z.string().min(1).optional()`);

        envVars.push({
          name,
          required: !isOptional,
          hasDefault: false,
        });
      }
    }
  }
}
