import { existsSync, readFileSync } from "fs";
import { join } from "path";

export interface AgentsmithConfig {
  output?: string;
  include?: string[];
  exclude?: string[];
  componentPaths?: string[];
  showProps?: boolean;
  showDescriptions?: boolean;
  maxComponents?: number;
}

const DEFAULT_CONFIG: AgentsmithConfig = {
  output: "AGENTS.md",
  include: ["components", "hooks", "routes", "tokens", "patterns", "variants", "env"],
  exclude: [],
  componentPaths: ["src/components", "components"],
  showProps: true,
  showDescriptions: true,
  maxComponents: 500,
};

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

export function getDefaultConfig(): AgentsmithConfig {
  return { ...DEFAULT_CONFIG };
}
