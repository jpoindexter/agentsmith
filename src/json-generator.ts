/**
 * JSON Index Generator
 *
 * Generates AGENTS.index.json - a machine-readable companion file
 * to AGENTS.md. Useful for programmatic access to component data.
 *
 * Used with the --json flag: agentsmith --json
 *
 * @module json-generator
 */

import type { ScanResult } from "./types.js";
import { estimateTokens } from "./utils/tokens.js";

/** Structure of the AGENTS.index.json file */
export interface AgentsIndex {
  /** Schema version */
  version: string;
  /** ISO timestamp of generation */
  generated: string;
  /** Project metadata */
  project: {
    framework: string;
    language: string;
    styling?: string;
  };
  /** Codebase statistics */
  stats: {
    components: number;
    hooks: number;
    routes: number;
    models: number;
    files: number;
    lines: number;
    tokens: number;
  };
  /** Component list with metadata */
  components: Array<{
    name: string;
    path: string;
    exports: string[];
    props?: string[];
    description?: string;
    complexity?: {
      propCount: number;
      importCount: number;
      lineCount: number;
      hasState: boolean;
      hasEffects: boolean;
      hasContext: boolean;
    };
  }>;
  /** Custom hooks */
  hooks: Array<{
    name: string;
    path: string;
    clientOnly: boolean;
  }>;
  /** API routes */
  routes: Array<{
    path: string;
    methods: string[];
    protected: boolean;
  }>;
  /** Database models */
  models: Array<{
    name: string;
    fields: string[];
    relations: string[];
  }>;
  /** Barrel exports for cleaner imports */
  barrels: Array<{
    path: string;
    exports: string[];
  }>;
}

/**
 * Generates JSON index from scan results
 *
 * @param result - Complete scan results
 * @param markdownContent - Generated markdown content (for token count)
 * @returns JSON string of the index
 */
export function generateAgentsIndex(result: ScanResult, markdownContent: string): string {
  const { components, framework, hooks, apiRoutes, database, stats, barrels } = result;

  const index: AgentsIndex = {
    version: "1.0",
    generated: new Date().toISOString(),
    project: {
      framework: `${framework.name}${framework.version ? ` ${framework.version}` : ""}${framework.router ? ` (${framework.router})` : ""}`,
      language: framework.language,
      ...(framework.styling && { styling: framework.styling }),
    },
    stats: {
      components: components.length,
      hooks: hooks.length,
      routes: apiRoutes.length,
      models: database?.models.length || 0,
      files: stats.totalFiles,
      lines: stats.totalLines,
      tokens: estimateTokens(markdownContent),
    },
    components: components.map(c => ({
      name: c.name,
      path: c.importPath,
      exports: c.exports,
      ...(c.props && { props: c.props }),
      ...(c.description && { description: c.description }),
      ...(c.complexity && { complexity: c.complexity }),
    })),
    hooks: hooks.map(h => ({
      name: h.name,
      path: h.importPath,
      clientOnly: h.isClientOnly,
    })),
    routes: apiRoutes.map(r => ({
      path: r.path,
      methods: r.methods,
      protected: r.isProtected,
    })),
    models: database?.models.map(m => ({
      name: m.name,
      fields: m.fields,
      relations: m.relations,
    })) || [],
    barrels: barrels.map(b => ({
      path: b.importPath,
      exports: b.exports.filter(e => !e.startsWith("*")),
    })),
  };

  return JSON.stringify(index, null, 2);
}
