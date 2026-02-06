#!/usr/bin/env node

/**
 * MCP Server for agentsmith
 *
 * Provides Model Context Protocol (MCP) integration for AI tools.
 * Exposes the following tools:
 * - pack_codebase: Generate AGENTS.md for a directory
 * - read_agents: Read existing AGENTS.md file
 * - search_components: Search for components by name
 * - get_component_info: Get detailed component information
 *
 * Start with: agentsmith --mcp
 *
 * @module mcp-server
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";

// Import scanners
import { scanComponents } from "./scanners/components.js";
import { scanTokens } from "./scanners/tokens.js";
import { detectFramework } from "./scanners/framework.js";
import { scanHooks } from "./scanners/hooks.js";
import { scanUtilities } from "./scanners/utilities.js";
import { scanCommands } from "./scanners/commands.js";
import { scanExistingContext } from "./scanners/existing-context.js";
import { scanVariants } from "./scanners/variants.js";
import { scanApiRoutes } from "./scanners/api-routes.js";
import { scanEnvVars } from "./scanners/env-vars.js";
import { scanPatterns } from "./scanners/patterns.js";
import { scanDatabase } from "./scanners/database.js";
import { scanStats } from "./scanners/stats.js";
import { scanBarrels } from "./scanners/barrels.js";
import { scanDependencies } from "./scanners/dependencies.js";
import { scanFileTree } from "./scanners/file-tree.js";
import { scanImports } from "./scanners/imports.js";
import { scanTypes } from "./scanners/types.js";
import { generateAntiPatterns } from "./scanners/anti-patterns.js";
import { scanTestCoverage } from "./scanners/tests.js";
import { scanGraphQL } from "./scanners/graphql.js";
import { analyzeComplexity } from "./scanners/complexity.js";
import { extractZodSchemasFromAST } from "./scanners/ast-schema-parser.js";
import { generateAgentsMd } from "./generator.js";
import { estimateTokens, formatTokens } from "./utils/tokens.js";

const server = new Server(
  {
    name: "agentsmith",
    version: "1.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "pack_codebase",
        description:
          "Generate AGENTS.md context for a codebase. Scans components, hooks, API routes, database models, and more.",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "The directory to scan (absolute path)",
            },
            minimal: {
              type: "boolean",
              description: "Generate minimal output (~3K tokens)",
              default: false,
            },
            compact: {
              type: "boolean",
              description: "Generate compact output",
              default: false,
            },
          },
          required: ["directory"],
        },
      },
      {
        name: "read_agents",
        description: "Read an existing AGENTS.md file from a directory",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "The directory containing AGENTS.md",
            },
          },
          required: ["directory"],
        },
      },
      {
        name: "search_components",
        description: "Search for components by name in a codebase",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "The directory to search",
            },
            query: {
              type: "string",
              description: "Search query (component name or partial match)",
            },
          },
          required: ["directory", "query"],
        },
      },
      {
        name: "get_component_info",
        description: "Get detailed information about a specific component",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "The directory containing the component",
            },
            componentName: {
              type: "string",
              description: "The name of the component",
            },
          },
          required: ["directory", "componentName"],
        },
      },
      // Granular scanners
      {
        name: "scan_api_routes",
        description: "Scan API routes with request/response schemas (Zod, TypeScript, tRPC)",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "The directory to scan",
            },
          },
          required: ["directory"],
        },
      },
      {
        name: "scan_database",
        description: "Scan database models (Prisma, Drizzle) with fields and relations",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "The directory to scan",
            },
          },
          required: ["directory"],
        },
      },
      {
        name: "scan_graphql",
        description: "Scan GraphQL schema definitions from .graphql and .gql files",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "The directory to scan",
            },
          },
          required: ["directory"],
        },
      },
      {
        name: "analyze_complexity",
        description: "Analyze codebase complexity and get AI model recommendations",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "The directory to analyze",
            },
          },
          required: ["directory"],
        },
      },
      {
        name: "scan_hooks",
        description: "Scan custom React hooks",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "The directory to scan",
            },
          },
          required: ["directory"],
        },
      },
      // Search tools
      {
        name: "search_api_routes",
        description: "Search API routes by path or method",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "The directory to search",
            },
            query: {
              type: "string",
              description: "Search query (path or method like GET, POST)",
            },
          },
          required: ["directory", "query"],
        },
      },
      {
        name: "search_database_models",
        description: "Search database models by name",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "The directory to search",
            },
            query: {
              type: "string",
              description: "Model name to search for",
            },
          },
          required: ["directory", "query"],
        },
      },
      {
        name: "search_hooks",
        description: "Search custom hooks by name",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "The directory to search",
            },
            query: {
              type: "string",
              description: "Hook name to search for",
            },
          },
          required: ["directory", "query"],
        },
      },
      // Detailed getters
      {
        name: "get_api_route_info",
        description: "Get detailed API route information including schemas and validations",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "The directory containing the route",
            },
            routePath: {
              type: "string",
              description: "The route path (e.g., /api/users)",
            },
          },
          required: ["directory", "routePath"],
        },
      },
      {
        name: "get_database_model_info",
        description: "Get detailed database model information with fields and relations",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "The directory containing the schema",
            },
            modelName: {
              type: "string",
              description: "The model name",
            },
          },
          required: ["directory", "modelName"],
        },
      },
      {
        name: "get_hook_info",
        description: "Get detailed custom hook information",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "The directory containing the hook",
            },
            hookName: {
              type: "string",
              description: "The hook name (e.g., useAuth)",
            },
          },
          required: ["directory", "hookName"],
        },
      },
      // Schema extraction
      {
        name: "get_file_schemas",
        description: "Extract Zod and TypeScript schemas from a specific file",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Absolute path to the file",
            },
          },
          required: ["filePath"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "pack_codebase": {
        const dir = resolve(args?.directory as string);
        const minimal = args?.minimal as boolean || false;
        const compact = args?.compact as boolean || false;

        if (!existsSync(dir)) {
          return {
            content: [{ type: "text", text: `Error: Directory not found: ${dir}` }],
            isError: true,
          };
        }

        // Run all scanners
        const [components, tokens, framework, hooks, utilities, commands, existingContext, variants, apiRoutes, envVars, patterns, database, stats, barrels, dependencies, fileTree, importGraph, typeExports] = await Promise.all([
          scanComponents(dir, []),
          scanTokens(dir),
          detectFramework(dir),
          scanHooks(dir),
          scanUtilities(dir),
          scanCommands(dir),
          scanExistingContext(dir),
          scanVariants(dir),
          scanApiRoutes(dir),
          scanEnvVars(dir),
          scanPatterns(dir),
          scanDatabase(dir),
          scanStats(dir),
          scanBarrels(dir),
          scanDependencies(dir),
          scanFileTree(dir),
          scanImports(dir),
          scanTypes(dir),
        ]);

        const antiPatterns = generateAntiPatterns(framework, utilities, tokens, components, utilities.hasMode);
        const testCoverage = await scanTestCoverage(dir, components);

        const content = generateAgentsMd(
          { components, tokens, framework, hooks, utilities, commands, existingContext, variants, apiRoutes, envVars, patterns, database, stats, barrels, dependencies, fileTree, importGraph, typeExports, antiPatterns, testCoverage },
          { minimal, compact }
        );

        const tokenCount = estimateTokens(content);

        return {
          content: [
            {
              type: "text",
              text: `Generated AGENTS.md (~${formatTokens(tokenCount)} tokens)\n\n${content}`,
            },
          ],
        };
      }

      case "read_agents": {
        const dir = resolve(args?.directory as string);
        const agentsPath = join(dir, "AGENTS.md");

        if (!existsSync(agentsPath)) {
          return {
            content: [{ type: "text", text: `No AGENTS.md found in ${dir}` }],
            isError: true,
          };
        }

        const content = readFileSync(agentsPath, "utf-8");
        return {
          content: [{ type: "text", text: content }],
        };
      }

      case "search_components": {
        const dir = resolve(args?.directory as string);
        const query = (args?.query as string || "").toLowerCase();

        const components = await scanComponents(dir, []);
        const matches = components.filter(
          c =>
            c.name.toLowerCase().includes(query) ||
            c.exports.some(e => e.toLowerCase().includes(query))
        );

        if (matches.length === 0) {
          return {
            content: [{ type: "text", text: `No components found matching "${query}"` }],
          };
        }

        const results = matches.map(c => {
          const exports = c.exports.map(e => `\`${e}\``).join(", ");
          const props = c.props ? ` | Props: ${c.props.join(", ")}` : "";
          return `- ${exports} — \`${c.importPath}\`${props}`;
        });

        return {
          content: [
            {
              type: "text",
              text: `Found ${matches.length} component(s) matching "${query}":\n\n${results.join("\n")}`,
            },
          ],
        };
      }

      case "get_component_info": {
        const dir = resolve(args?.directory as string);
        const componentName = args?.componentName as string;

        const components = await scanComponents(dir, []);
        const component = components.find(
          c =>
            c.name === componentName ||
            c.exports.includes(componentName)
        );

        if (!component) {
          return {
            content: [{ type: "text", text: `Component "${componentName}" not found` }],
            isError: true,
          };
        }

        // Read the component file content
        const filePath = join(dir, component.path);
        let fileContent = "";
        if (existsSync(filePath)) {
          fileContent = readFileSync(filePath, "utf-8");
        }

        const info = [
          `# ${component.name}`,
          "",
          `**Path:** \`${component.path}\``,
          `**Import:** \`${component.importPath}\``,
          `**Exports:** ${component.exports.join(", ")}`,
        ];

        if (component.props && component.props.length > 0) {
          info.push(`**Props:** ${component.props.join(", ")}`);
        }

        if (component.description) {
          info.push(`**Description:** ${component.description}`);
        }

        if (component.complexity) {
          info.push("");
          info.push("## Complexity Metrics");
          info.push(`- Props: ${component.complexity.propCount}`);
          info.push(`- Imports: ${component.complexity.importCount}`);
          info.push(`- Lines: ${component.complexity.lineCount}`);
          info.push(`- Uses State: ${component.complexity.hasState ? "Yes" : "No"}`);
          info.push(`- Uses Effects: ${component.complexity.hasEffects ? "Yes" : "No"}`);
          info.push(`- Uses Context: ${component.complexity.hasContext ? "Yes" : "No"}`);
        }

        if (fileContent) {
          info.push("");
          info.push("## Source Code");
          info.push("");
          info.push("```tsx");
          info.push(fileContent);
          info.push("```");
        }

        return {
          content: [{ type: "text", text: info.join("\n") }],
        };
      }

      // Granular scanner handlers
      case "scan_api_routes": {
        const dir = resolve(args?.directory as string);
        const routes = await scanApiRoutes(dir);

        const output = routes.map(r => {
          const methods = r.methods.join(", ");
          const auth = r.isProtected ? "🔒" : "";
          let line = `- \`${methods}\` \`${r.path}\` ${auth}`.trim();

          if (r.requestSchema) {
            line += `\n  Request: ${formatSchemaInline(r.requestSchema)}`;
          }
          if (r.responseSchema) {
            line += `\n  Response: ${formatSchemaInline(r.responseSchema)}`;
          }

          return line;
        });

        return {
          content: [{
            type: "text",
            text: `Found ${routes.length} API routes:\n\n${output.join("\n\n")}`,
          }],
        };
      }

      case "scan_database": {
        const dir = resolve(args?.directory as string);
        const database = await scanDatabase(dir);

        if (!database) {
          return {
            content: [{ type: "text", text: "No database schema found" }],
          };
        }

        const output = database.models.map(m => {
          const fields = m.fields.slice(0, 5).map(f => f.name).join(", ");
          const more = m.fields.length > 5 ? `, +${m.fields.length - 5} more` : "";
          const rels = m.relations?.length ? ` | ${m.relations.length} relations` : "";
          return `- **${m.name}** — ${fields}${more}${rels}`;
        });

        return {
          content: [{
            type: "text",
            text: `Found ${database.models.length} models (${database.type}):\n\n${output.join("\n")}`,
          }],
        };
      }

      case "scan_graphql": {
        const dir = resolve(args?.directory as string);
        const schemas = await scanGraphQL(dir);

        if (schemas.size === 0) {
          return {
            content: [{ type: "text", text: "No GraphQL schemas found" }],
          };
        }

        const output = Array.from(schemas.entries()).map(([name, schema]) => {
          const fields = schema.fields.slice(0, 5).map(f => `${f.name}: ${f.type}`).join(", ");
          const more = schema.fields.length > 5 ? `, +${schema.fields.length - 5} more` : "";
          return `- **${name}** — ${fields}${more}`;
        });

        return {
          content: [{
            type: "text",
            text: `Found ${schemas.size} GraphQL types:\n\n${output.join("\n")}`,
          }],
        };
      }

      case "analyze_complexity": {
        const dir = resolve(args?.directory as string);
        const analysis = await analyzeComplexity(dir);

        const areas = analysis.areas.slice(0, 5).map(a => {
          const icon = a.level === "high" ? "🔴" : a.level === "medium" ? "🟡" : "🟢";
          return `${icon} **${a.name}**: ${a.avgScore}/100 (${a.fileCount} files)`;
        });

        const files = analysis.complexFiles.slice(0, 3).map(f => {
          return `- \`${f.path}\` (${f.score}/100) — ${f.reasons.slice(0, 2).join(", ")}`;
        });

        return {
          content: [{
            type: "text",
            text: `# Complexity Analysis\n\n` +
              `**Recommended:**\n- Simple tasks: ${analysis.simpleModel} effort\n- Complex tasks: ${analysis.complexModel} effort\n` +
              `${analysis.extendedThinkingRecommended ? "- Extended thinking recommended\n" : ""}\n` +
              `**By Area:**\n${areas.join("\n")}\n\n` +
              `**Most Complex Files:**\n${files.join("\n")}`,
          }],
        };
      }

      case "scan_hooks": {
        const dir = resolve(args?.directory as string);
        const hooks = await scanHooks(dir);

        const output = hooks.map(h => {
          const client = h.isClientOnly ? " (client)" : "";
          return `- \`${h.name}\`${client} — \`${h.path}\``;
        });

        return {
          content: [{
            type: "text",
            text: `Found ${hooks.length} custom hooks:\n\n${output.join("\n")}`,
          }],
        };
      }

      // Search handlers
      case "search_api_routes": {
        const dir = resolve(args?.directory as string);
        const query = (args?.query as string || "").toLowerCase();
        const routes = await scanApiRoutes(dir);

        const matches = routes.filter(r =>
          r.path.toLowerCase().includes(query) ||
          r.methods.some(m => m.toLowerCase() === query)
        );

        if (matches.length === 0) {
          return {
            content: [{ type: "text", text: `No routes found matching "${query}"` }],
          };
        }

        const output = matches.map(r => {
          const methods = r.methods.join(", ");
          const auth = r.isProtected ? "🔒" : "";
          return `- \`${methods}\` \`${r.path}\` ${auth}`.trim();
        });

        return {
          content: [{
            type: "text",
            text: `Found ${matches.length} route(s) matching "${query}":\n\n${output.join("\n")}`,
          }],
        };
      }

      case "search_database_models": {
        const dir = resolve(args?.directory as string);
        const query = (args?.query as string || "").toLowerCase();
        const database = await scanDatabase(dir);

        if (!database) {
          return {
            content: [{ type: "text", text: "No database schema found" }],
          };
        }

        const matches = database.models.filter(m =>
          m.name.toLowerCase().includes(query)
        );

        if (matches.length === 0) {
          return {
            content: [{ type: "text", text: `No models found matching "${query}"` }],
          };
        }

        const output = matches.map(m => {
          const fields = m.fields.slice(0, 3).map(f => f.name).join(", ");
          return `- **${m.name}** — ${fields}, ...`;
        });

        return {
          content: [{
            type: "text",
            text: `Found ${matches.length} model(s) matching "${query}":\n\n${output.join("\n")}`,
          }],
        };
      }

      case "search_hooks": {
        const dir = resolve(args?.directory as string);
        const query = (args?.query as string || "").toLowerCase();
        const hooks = await scanHooks(dir);

        const matches = hooks.filter(h =>
          h.name.toLowerCase().includes(query)
        );

        if (matches.length === 0) {
          return {
            content: [{ type: "text", text: `No hooks found matching "${query}"` }],
          };
        }

        const output = matches.map(h => {
          return `- \`${h.name}\` — \`${h.path}\``;
        });

        return {
          content: [{
            type: "text",
            text: `Found ${matches.length} hook(s) matching "${query}":\n\n${output.join("\n")}`,
          }],
        };
      }

      // Detailed getter handlers
      case "get_api_route_info": {
        const dir = resolve(args?.directory as string);
        const routePath = args?.routePath as string;
        const routes = await scanApiRoutes(dir);

        const route = routes.find(r => r.path === routePath);

        if (!route) {
          return {
            content: [{ type: "text", text: `Route "${routePath}" not found` }],
            isError: true,
          };
        }

        const info = [
          `# ${route.path}`,
          "",
          `**Methods:** ${route.methods.join(", ")}`,
          `**Protected:** ${route.isProtected ? "Yes 🔒" : "No"}`,
        ];

        if (route.description) {
          info.push(`**Description:** ${route.description}`);
        }

        if (route.requestSchema) {
          info.push("");
          info.push("## Request Schema");
          info.push("");
          info.push(formatSchemaDetailed(route.requestSchema));
        }

        if (route.responseSchema) {
          info.push("");
          info.push("## Response Schema");
          info.push("");
          info.push(formatSchemaDetailed(route.responseSchema));
        }

        if (route.querySchema) {
          info.push("");
          info.push("## Query Parameters");
          info.push("");
          info.push(formatSchemaDetailed(route.querySchema));
        }

        return {
          content: [{ type: "text", text: info.join("\n") }],
        };
      }

      case "get_database_model_info": {
        const dir = resolve(args?.directory as string);
        const modelName = args?.modelName as string;
        const database = await scanDatabase(dir);

        if (!database) {
          return {
            content: [{ type: "text", text: "No database schema found" }],
            isError: true,
          };
        }

        const model = database.models.find(m => m.name === modelName);

        if (!model) {
          return {
            content: [{ type: "text", text: `Model "${modelName}" not found` }],
            isError: true,
          };
        }

        const info = [
          `# ${model.name}`,
          "",
          "## Fields",
          "",
        ];

        for (const field of model.fields) {
          const attrs = [];
          if (field.isPrimaryKey) attrs.push("PK");
          if (field.isUnique) attrs.push("unique");
          if (field.isRequired === false) attrs.push("optional");
          if (field.defaultValue) attrs.push(`default: ${field.defaultValue}`);

          const attrStr = attrs.length > 0 ? ` (${attrs.join(", ")})` : "";
          info.push(`- **${field.name}**: ${field.type}${attrStr}`);
        }

        if (model.relations && model.relations.length > 0) {
          info.push("");
          info.push("## Relations");
          info.push("");
          for (const rel of model.relations) {
            info.push(`- **${rel.name}** → ${rel.model} (${rel.type})`);
          }
        }

        return {
          content: [{ type: "text", text: info.join("\n") }],
        };
      }

      case "get_hook_info": {
        const dir = resolve(args?.directory as string);
        const hookName = args?.hookName as string;
        const hooks = await scanHooks(dir);

        const hook = hooks.find(h => h.name === hookName);

        if (!hook) {
          return {
            content: [{ type: "text", text: `Hook "${hookName}" not found` }],
            isError: true,
          };
        }

        // Read the hook file content
        const filePath = join(dir, hook.path);
        let fileContent = "";
        if (existsSync(filePath)) {
          fileContent = readFileSync(filePath, "utf-8");
        }

        const info = [
          `# ${hook.name}`,
          "",
          `**Path:** \`${hook.path}\``,
          `**Client Only:** ${hook.isClientOnly ? "Yes" : "No"}`,
        ];

        if (fileContent) {
          info.push("");
          info.push("## Source Code");
          info.push("");
          info.push("```typescript");
          info.push(fileContent);
          info.push("```");
        }

        return {
          content: [{ type: "text", text: info.join("\n") }],
        };
      }

      // Schema extraction handler
      case "get_file_schemas": {
        const filePath = args?.filePath as string;

        if (!existsSync(filePath)) {
          return {
            content: [{ type: "text", text: `File not found: ${filePath}` }],
            isError: true,
          };
        }

        const content = readFileSync(filePath, "utf-8");
        const schemas = extractZodSchemasFromAST(content, filePath, filePath);

        if (schemas.size === 0) {
          return {
            content: [{ type: "text", text: "No schemas found in file" }],
          };
        }

        const output = Array.from(schemas.entries()).map(([name, schema]) => {
          return `## ${name}\n\nSource: ${schema.source}\n\n${formatSchemaDetailed(schema)}`;
        });

        return {
          content: [{
            type: "text",
            text: `Found ${schemas.size} schema(s):\n\n${output.join("\n\n---\n\n")}`,
          }],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Helper functions for schema formatting
import type { ApiSchema } from "./types.js";

function formatSchemaInline(schema: ApiSchema): string {
  const fields = schema.fields.slice(0, 3).map(f => {
    const opt = f.isOptional ? "?" : "";
    const val = f.validations && f.validations.length > 0 ? ` (${f.validations[0]})` : "";
    return `${f.name}${opt}: ${f.type}${val}`;
  });

  const more = schema.fields.length > 3 ? `, +${schema.fields.length - 3} more` : "";
  return `{ ${fields.join(", ")}${more} }`;
}

function formatSchemaDetailed(schema: ApiSchema): string {
  const lines: string[] = [];

  for (const field of schema.fields) {
    const opt = field.isOptional ? "?" : "";
    const val = field.validations && field.validations.length > 0
      ? ` — ${field.validations.join(", ")}`
      : "";

    if (field.nested && field.nested.length > 0) {
      lines.push(`- **${field.name}${opt}**: ${field.type} {`);
      for (const nested of field.nested.slice(0, 5)) {
        const nestedOpt = nested.isOptional ? "?" : "";
        lines.push(`  - ${nested.name}${nestedOpt}: ${nested.type}`);
      }
      if (field.nested.length > 5) {
        lines.push(`  - ... +${field.nested.length - 5} more fields`);
      }
      lines.push("}");
    } else {
      lines.push(`- **${field.name}${opt}**: ${field.type}${val}`);
    }
  }

  return lines.join("\n");
}

export async function startMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Agentsmith MCP server running on stdio");
}

// Run if this is the main module
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  startMcpServer().catch(console.error);
}
