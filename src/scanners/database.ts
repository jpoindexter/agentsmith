/**
 * Database Schema Scanner
 *
 * Scans for database schema definitions from popular ORMs:
 * - Prisma (schema.prisma files)
 * - Drizzle ORM (TypeScript table definitions)
 *
 * Extracts model names, fields, and relationships for documentation.
 *
 * @module scanners/database
 */

import fg from "fast-glob";
import { readFileSync } from "fs";

/** Represents a database model/table with its fields and relations */
export interface DatabaseModel {
  /** Model/table name */
  name: string;
  /** Scalar field names (strings, numbers, dates, etc.) */
  fields: string[];
  /** Relation field names (references to other models) */
  relations: string[];
}

/** Database schema information from ORM */
export interface DatabaseSchema {
  /** ORM provider detected */
  provider: "prisma" | "drizzle" | "unknown";
  /** All discovered models */
  models: DatabaseModel[];
}

/**
 * Scans for database schema and extracts model information
 *
 * @param dir - Project root directory
 * @returns Database schema if found, null otherwise
 *
 * @example
 * const schema = await scanDatabase('/path/to/project');
 * // Returns: { provider: 'prisma', models: [{ name: 'User', fields: [...], relations: [...] }] }
 */
export async function scanDatabase(dir: string): Promise<DatabaseSchema | null> {
  // Try Prisma first
  const prismaSchema = await scanPrisma(dir);
  if (prismaSchema) return prismaSchema;

  // Try Drizzle
  const drizzleSchema = await scanDrizzle(dir);
  if (drizzleSchema) return drizzleSchema;

  return null;
}

/** Scans for Prisma schema files and extracts models */
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

/**
 * Extracts model definitions from Prisma schema content
 * Parses model blocks and categorizes fields vs relations
 */
function extractPrismaModels(content: string): DatabaseModel[] {
  const models: DatabaseModel[] = [];

  // model ModelName { ... }
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

/** Scans for Drizzle ORM schema files and extracts table definitions */
async function scanDrizzle(dir: string): Promise<DatabaseSchema | null> {
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

/**
 * Extracts table definitions from Drizzle ORM schema content
 * Supports pgTable, mysqlTable, and sqliteTable definitions
 */
function extractDrizzleTables(content: string): DatabaseModel[] {
  const models: DatabaseModel[] = [];

  // export const tableName = pgTable('table_name', { ... })
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
