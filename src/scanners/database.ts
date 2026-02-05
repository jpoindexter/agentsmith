import fg from "fast-glob";
import { readFileSync } from "fs";

export interface DatabaseModel {
  name: string;
  fields: string[];
  relations: string[];
}

export interface DatabaseSchema {
  provider: "prisma" | "drizzle" | "unknown";
  models: DatabaseModel[];
}

export async function scanDatabase(dir: string): Promise<DatabaseSchema | null> {
  // Try Prisma first
  const prismaSchema = await scanPrisma(dir);
  if (prismaSchema) return prismaSchema;

  // Try Drizzle
  const drizzleSchema = await scanDrizzle(dir);
  if (drizzleSchema) return drizzleSchema;

  return null;
}

async function scanPrisma(dir: string): Promise<DatabaseSchema | null> {
  const files = await fg(["prisma/schema.prisma", "schema.prisma"], {
    cwd: dir,
    absolute: false,
  });

  if (files.length === 0) return null;

  const content = readFileSync(`${dir}/${files[0]}`, "utf-8");
  const models = extractPrismaModels(content);

  if (models.length === 0) return null;

  return {
    provider: "prisma",
    models,
  };
}

function extractPrismaModels(content: string): DatabaseModel[] {
  const models: DatabaseModel[] = [];

  // Match model definitions: model ModelName { ... }
  const modelMatches = content.matchAll(/model\s+(\w+)\s*\{([^}]+)\}/g);

  for (const match of modelMatches) {
    const modelName = match[1];
    const modelBody = match[2];

    const fields: string[] = [];
    const relations: string[] = [];

    // Parse each line in the model body
    const lines = modelBody.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("@@")) continue;

      // Match field: fieldName Type ...
      const fieldMatch = trimmed.match(/^(\w+)\s+(\w+)(\[\])?/);
      if (fieldMatch) {
        const fieldName = fieldMatch[1];
        const fieldType = fieldMatch[2];

        // Check if it's a relation (type is another model, not a scalar)
        const scalarTypes = ["String", "Int", "Float", "Boolean", "DateTime", "Json", "Bytes", "BigInt", "Decimal"];
        if (!scalarTypes.includes(fieldType)) {
          relations.push(fieldName);
        } else {
          fields.push(fieldName);
        }
      }
    }

    models.push({
      name: modelName,
      fields,
      relations,
    });
  }

  return models;
}

async function scanDrizzle(dir: string): Promise<DatabaseSchema | null> {
  // Look for Drizzle schema files in common locations
  const files = await fg(
    [
      "**/schema.ts",
      "**/schema/*.ts",
      "**/db/schema.ts",
      "**/db/schema/*.ts",
      "**/drizzle/schema.ts",
      "**/drizzle/schema/*.ts",
      "**/src/db/schema.ts",
      "**/src/db/schema/*.ts",
    ],
    {
      cwd: dir,
      absolute: false,
      ignore: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    }
  );

  if (files.length === 0) return null;

  const allModels: DatabaseModel[] = [];

  for (const file of files) {
    const content = readFileSync(`${dir}/${file}`, "utf-8");

    // Check if this is a Drizzle file by looking for table definitions
    if (!content.includes("Table(") && !content.includes("table(")) continue;

    const models = extractDrizzleTables(content);
    allModels.push(...models);
  }

  if (allModels.length === 0) return null;

  return {
    provider: "drizzle",
    models: allModels,
  };
}

function extractDrizzleTables(content: string): DatabaseModel[] {
  const models: DatabaseModel[] = [];

  // Match table definitions: export const tableName = pgTable('table_name', { ... })
  // Supports: pgTable, mysqlTable, sqliteTable
  const tableRegex =
    /(?:export\s+)?const\s+(\w+)\s*=\s*(?:pg|mysql|sqlite)Table\s*\(\s*['"`](\w+)['"`]\s*,\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g;

  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    const varName = match[1];
    const tableName = match[2];
    const tableBody = match[3];

    const fields: string[] = [];
    const relations: string[] = [];

    // Extract column definitions
    // Match: columnName: dataType('column_name')... or columnName: dataType()...
    const columnRegex = /(\w+)\s*:\s*(\w+)\s*\(/g;
    let colMatch;
    while ((colMatch = columnRegex.exec(tableBody)) !== null) {
      const columnName = colMatch[1];
      const columnType = colMatch[2];

      // Check if it's a relation type
      if (columnType === "references" || columnName.endsWith("Id")) {
        // Likely a foreign key, but we'll still count it as a field
        fields.push(columnName);
      } else {
        fields.push(columnName);
      }
    }

    // Also scan for Drizzle relations defined separately
    // relations(tableName, ({ one, many }) => ({ ... }))
    const relationRegex = new RegExp(
      `relations\\s*\\(\\s*${varName}\\s*,.*?\\{([^}]+)\\}`,
      "s"
    );
    const relMatch = content.match(relationRegex);
    if (relMatch) {
      const relBody = relMatch[1];
      // Match: relationName: one(OtherTable, ...) or relationName: many(OtherTable, ...)
      const relFieldRegex = /(\w+)\s*:\s*(?:one|many)\s*\(\s*(\w+)/g;
      let relFieldMatch;
      while ((relFieldMatch = relFieldRegex.exec(relBody)) !== null) {
        relations.push(relFieldMatch[1]);
      }
    }

    models.push({
      name: tableName,
      fields,
      relations,
    });
  }

  return models;
}
