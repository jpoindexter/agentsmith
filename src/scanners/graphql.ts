/**
 * GraphQL Schema Scanner
 *
 * Discovers GraphQL schemas in .graphql and .gql files.
 * Extracts types, inputs, enums, and converts them to ApiSchema format.
 *
 * Supports:
 * - Type definitions (type User { ... })
 * - Input types (input CreateUserInput { ... })
 * - Enum types (enum Role { ... })
 * - Scalars and object types
 *
 * @module scanners/graphql
 */

import fg from "fast-glob";
import { readFileSync } from "fs";
import { parse, DocumentNode, DefinitionNode, FieldDefinitionNode, InputValueDefinitionNode, TypeNode } from "graphql";
import type { ApiSchema, ApiField } from "../types.js";

/**
 * Scans for GraphQL schema files and extracts type definitions
 *
 * @param dir - Project root directory
 * @returns Map of schema name to ApiSchema
 *
 * @example
 * const schemas = await scanGraphQL('/path/to/project');
 * // Returns: Map { 'User' => { source: 'graphql', fields: [...] } }
 */
export async function scanGraphQL(dir: string): Promise<Map<string, ApiSchema>> {
  const files = await fg(["**/*.graphql", "**/*.gql"], {
    cwd: dir,
    absolute: false,
    ignore: ["node_modules/**", ".next/**", "dist/**", "build/**"],
  });

  const schemas = new Map<string, ApiSchema>();

  for (const file of files) {
    try {
      const content = readFileSync(`${dir}/${file}`, "utf-8");
      const ast = parse(content);

      // Extract schemas from AST
      extractSchemasFromAST(ast, schemas, file);
    } catch (error) {
      // Skip files with parse errors (could be schema fragments, etc.)
      continue;
    }
  }

  return schemas;
}

/**
 * Extracts type definitions from GraphQL AST
 */
function extractSchemasFromAST(ast: DocumentNode, schemas: Map<string, ApiSchema>, filePath: string): void {
  for (const definition of ast.definitions) {
    // Only process type definitions (types, inputs, enums)
    if (definition.kind !== "ObjectTypeDefinition" &&
        definition.kind !== "InputObjectTypeDefinition" &&
        definition.kind !== "EnumTypeDefinition") {
      continue;
    }

    const typeName = definition.name.value;

    // Skip Query, Mutation, Subscription root types (these are operations, not schemas)
    if (["Query", "Mutation", "Subscription"].includes(typeName)) {
      continue;
    }

    // Extract fields based on definition kind
    let fields: ApiField[] = [];

    if (definition.kind === "ObjectTypeDefinition" && definition.fields) {
      fields = definition.fields.map((field: FieldDefinitionNode) =>
        convertFieldToApiField(field)
      );
    } else if (definition.kind === "InputObjectTypeDefinition" && definition.fields) {
      fields = definition.fields.map((field: InputValueDefinitionNode) =>
        convertInputValueToApiField(field)
      );
    } else if (definition.kind === "EnumTypeDefinition" && definition.values) {
      // For enums, treat each value as a field with type "enum"
      fields = definition.values.map(value => ({
        name: value.name.value,
        type: "enum",
        isOptional: false,
      }));
    }

    schemas.set(typeName, {
      source: "graphql" as const,
      name: typeName,
      fields,
      isRequired: true,
    });
  }
}

/**
 * Converts GraphQL FieldDefinition to ApiField
 */
function convertFieldToApiField(field: FieldDefinitionNode): ApiField {
  const fieldName = field.name.value;
  const { type, isOptional } = parseTypeNode(field.type);

  // Extract arguments if present (for query fields)
  const validations: string[] = [];
  if (field.arguments && field.arguments.length > 0) {
    validations.push(`args: ${field.arguments.length}`);
  }

  return {
    name: fieldName,
    type,
    isOptional,
    validations: validations.length > 0 ? validations : undefined,
  };
}

/**
 * Converts GraphQL InputValueDefinition to ApiField
 */
function convertInputValueToApiField(field: InputValueDefinitionNode): ApiField {
  const fieldName = field.name.value;
  const { type, isOptional } = parseTypeNode(field.type);

  return {
    name: fieldName,
    type,
    isOptional,
  };
}

/**
 * Parses GraphQL TypeNode to extract type and optionality
 */
function parseTypeNode(typeNode: TypeNode): { type: string; isOptional: boolean } {
  if (typeNode.kind === "NonNullType") {
    // Non-null means required (not optional)
    const innerType = parseTypeNode(typeNode.type);
    return { ...innerType, isOptional: false };
  }

  if (typeNode.kind === "ListType") {
    const innerType = parseTypeNode(typeNode.type);
    return { type: `${innerType.type}[]`, isOptional: true };
  }

  if (typeNode.kind === "NamedType") {
    const typeName = typeNode.name.value;

    // Map GraphQL scalar types to common types
    const typeMap: Record<string, string> = {
      "String": "string",
      "Int": "number",
      "Float": "number",
      "Boolean": "boolean",
      "ID": "string",
    };

    return {
      type: typeMap[typeName] || typeName,
      isOptional: true, // Named types are optional unless wrapped in NonNullType
    };
  }

  return { type: "unknown", isOptional: true };
}

/**
 * Formats GraphQL schemas for display in AGENTS.md
 */
export function formatGraphQLSchemas(schemas: Map<string, ApiSchema>): string {
  if (schemas.size === 0) return "";

  const lines: string[] = [];
  lines.push("## GraphQL Schemas");
  lines.push("");
  lines.push(`${schemas.size} GraphQL type${schemas.size === 1 ? "" : "s"} defined:`);
  lines.push("");

  // Group schemas by category
  const types: ApiSchema[] = [];
  const inputs: ApiSchema[] = [];
  const enums: ApiSchema[] = [];

  for (const schema of schemas.values()) {
    if (schema.name?.endsWith("Input")) {
      inputs.push(schema);
    } else if (schema.fields.every(f => f.type === "enum")) {
      enums.push(schema);
    } else {
      types.push(schema);
    }
  }

  // Display Types
  if (types.length > 0) {
    lines.push(`### Types (${types.length})`);
    lines.push("");
    for (const schema of types) {
      lines.push(`**${schema.name}**`);
      lines.push("```graphql");
      lines.push(`type ${schema.name} {`);
      for (const field of schema.fields) {
        const optional = field.isOptional ? "" : "!";
        lines.push(`  ${field.name}: ${field.type}${optional}`);
      }
      lines.push("}");
      lines.push("```");
      lines.push("");
    }
  }

  // Display Inputs
  if (inputs.length > 0) {
    lines.push(`### Inputs (${inputs.length})`);
    lines.push("");
    for (const schema of inputs) {
      lines.push(`**${schema.name}**`);
      lines.push("```graphql");
      lines.push(`input ${schema.name} {`);
      for (const field of schema.fields) {
        const optional = field.isOptional ? "" : "!";
        lines.push(`  ${field.name}: ${field.type}${optional}`);
      }
      lines.push("}");
      lines.push("```");
      lines.push("");
    }
  }

  // Display Enums
  if (enums.length > 0) {
    lines.push(`### Enums (${enums.length})`);
    lines.push("");
    for (const schema of enums) {
      const values = schema.fields.map(f => f.name).join(" | ");
      lines.push(`- **${schema.name}**: ${values}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
