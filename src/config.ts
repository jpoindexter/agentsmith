/**
 * Configuration Loader
 *
 * Loads agentsmith configuration from project files.
 * Searches for configuration in these locations (in order):
 * - agentsmith.config.json
 * - agentsmith.config.js
 * - .agentsmithrc
 * - .agentsmithrc.json
 *
 * @module config
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

/** Agentsmith configuration options */
export interface AgentsmithConfig {
  /** Output file path (default: "AGENTS.md") */
  output?: string;
  /** Sections to include in output */
  include?: string[];
  /** Glob patterns to exclude from scanning */
  exclude?: string[];
  /** Paths to scan for components */
  componentPaths?: string[];
  /** Include prop information in output */
  showProps?: boolean;
  /** Include JSDoc descriptions in output */
  showDescriptions?: boolean;
  /** Maximum components to include (default: 500) */
  maxComponents?: number;
}

/** Default configuration values */
const DEFAULT_CONFIG: AgentsmithConfig = {
  output: "AGENTS.md",
  include: ["components", "hooks", "routes", "tokens", "patterns", "variants", "env"],
  exclude: [],
  componentPaths: ["src/components", "components"],
  showProps: true,
  showDescriptions: true,
  maxComponents: 500,
};

/**
 * Loads configuration from project directory
 *
 * @param dir - Project root directory
 * @returns Merged configuration (user config + defaults)
 */
export function loadConfig(dir: string): AgentsmithConfig {
  const configPaths = [
    join(dir, "agentsmith.config.json"),
    join(dir, "agentsmith.config.js"),
    join(dir, ".agentsmithrc"),
    join(dir, ".agentsmithrc.json"),
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        if (configPath.endsWith(".js")) {
          // Skip JS config for now (would need dynamic import)
          continue;
        }

        const content = readFileSync(configPath, "utf-8");
        const userConfig = JSON.parse(content) as Partial<AgentsmithConfig>;

        return {
          ...DEFAULT_CONFIG,
          ...userConfig,
        };
      } catch {
        // Invalid config, use defaults
      }
    }
  }

  return DEFAULT_CONFIG;
}

/** Returns a copy of the default configuration */
export function getDefaultConfig(): AgentsmithConfig {
  return { ...DEFAULT_CONFIG };
}
