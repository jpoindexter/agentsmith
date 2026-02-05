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
import { generateAgentsMd } from "./generator.js";
import { estimateTokens, formatTokens } from "./utils/tokens.js";

const server = new Server(
  {
    name: "agentsmith",
    version: "1.0.0",
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
