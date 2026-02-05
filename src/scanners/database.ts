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

  // Try Drizzle (future)
  // const drizzleSchema = await scanDrizzle(dir);
  // if (drizzleSchema) return drizzleSchema;

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
