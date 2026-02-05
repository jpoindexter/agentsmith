#!/usr/bin/env node

import { cac } from "cac";
import pc from "picocolors";
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
import { scanStats, formatBytes } from "./scanners/stats.js";
import { scanBarrels } from "./scanners/barrels.js";
import { scanDependencies } from "./scanners/dependencies.js";
import { generateAgentsMd } from "./generator.js";
import { generateAgentsIndex } from "./json-generator.js";
import { estimateTokens, formatTokens, getContextUsage } from "./utils/tokens.js";
import { loadConfig } from "./config.js";
import { writeFileSync } from "fs";
import { join } from "path";

const cli = cac("agentsmith");

cli
  .command("[dir]", "Generate AGENTS.md from your codebase")
  .option("-o, --output <file>", "Output file path", { default: "AGENTS.md" })
  .option("--dry-run", "Preview without writing file")
  .option("--force", "Overwrite existing AGENTS.md even if it has custom content")
  .option("--compact", "Generate compact output (fewer details, smaller token count)")
  .option("--json", "Also generate AGENTS.index.json for programmatic access")
  .action(async (dir: string | undefined, options: { output: string; dryRun?: boolean; force?: boolean; compact?: boolean; json?: boolean }) => {
    const targetDir = dir || process.cwd();

    // Load config file if present
    const config = loadConfig(targetDir);
    const outputFile = options.output !== "AGENTS.md" ? options.output : config.output || "AGENTS.md";

    console.log(pc.cyan("\n  agentsmith\n"));
    console.log(pc.dim(`  Scanning ${targetDir}...\n`));

    try {
      // Run all scanners in parallel
      const [components, tokens, framework, hooks, utilities, commands, existingContext, variants, apiRoutes, envVars, patterns, database, stats, barrels, dependencies] = await Promise.all([
        scanComponents(targetDir),
        scanTokens(targetDir),
        detectFramework(targetDir),
        scanHooks(targetDir),
        scanUtilities(targetDir),
        scanCommands(targetDir),
        scanExistingContext(targetDir),
        scanVariants(targetDir),
        scanApiRoutes(targetDir),
        scanEnvVars(targetDir),
        scanPatterns(targetDir),
        scanDatabase(targetDir),
        scanStats(targetDir),
        scanBarrels(targetDir),
        scanDependencies(targetDir),
      ]);

      // Report findings
      console.log(pc.green(`  ✓ Found ${components.length} components`));
      if (variants.length > 0) {
        console.log(pc.green(`  ✓ Found ${variants.length} components with CVA variants`));
      }
      console.log(pc.green(`  ✓ Found ${Object.keys(tokens.colors).length} color tokens`));
      console.log(pc.green(`  ✓ Found ${hooks.length} custom hooks`));
      if (apiRoutes.length > 0) {
        console.log(pc.green(`  ✓ Found ${apiRoutes.length} API routes`));
      }
      if (envVars.length > 0) {
        console.log(pc.green(`  ✓ Found ${envVars.length} environment variables`));
      }
      console.log(pc.green(`  ✓ Detected ${framework.name}${framework.router ? ` (${framework.router})` : ""}`));

      if (utilities.hasShadcn) {
        console.log(pc.green(`  ✓ Detected shadcn/ui (${utilities.radixPackages.length} Radix packages)`));
      }
      if (utilities.hasCn) {
        console.log(pc.green(`  ✓ Found cn() utility`));
      }
      if (utilities.hasMode) {
        console.log(pc.green(`  ✓ Found mode/design-system`));
      }
      if (patterns.patterns.length > 0) {
        console.log(pc.green(`  ✓ Detected ${patterns.patterns.length} code patterns`));
      }
      if (existingContext.hasClaudeMd) {
        console.log(pc.green(`  ✓ Found existing ${existingContext.claudeMdPath}`));
      }
      if (existingContext.hasAiFolder) {
        console.log(pc.green(`  ✓ Found .ai/ folder (${existingContext.aiFiles.length} files)`));
      }
      if (database) {
        console.log(pc.green(`  ✓ Found ${database.provider} schema (${database.models.length} models)`));
      }
      console.log(pc.green(`  ✓ Scanned ${stats.totalFiles} files (${formatBytes(stats.totalSize)}, ${stats.totalLines.toLocaleString()} lines)`));
      if (barrels.length > 0) {
        console.log(pc.green(`  ✓ Found ${barrels.length} barrel exports`));
      }

      // Check for existing non-generated AGENTS.md
      if (existingContext.hasAgentsMd && !options.force) {
        console.log(pc.yellow(`\n  ⚠ Found existing ${existingContext.agentsMdPath} with custom content`));
        console.log(pc.yellow(`    Use --force to overwrite\n`));
        return;
      }

      // Generate AGENTS.md content
      const content = generateAgentsMd(
        { components, tokens, framework, hooks, utilities, commands, existingContext, variants, apiRoutes, envVars, patterns, database, stats, barrels, dependencies },
        { compact: options.compact }
      );

      // Calculate token estimate
      const tokenCount = estimateTokens(content);
      const contextUsage = getContextUsage(tokenCount);

      if (options.dryRun) {
        console.log(pc.yellow("\n  Dry run - would generate:\n"));
        console.log(pc.dim("  " + outputFile));
        if (options.json) {
          console.log(pc.dim("  " + outputFile.replace(".md", ".index.json")));
        }
        console.log(pc.dim(`  ${content.length.toLocaleString()} chars · ~${formatTokens(tokenCount)} tokens (${contextUsage}% of 128K context)\n`));
      } else {
        const outputPath = join(targetDir, outputFile);
        writeFileSync(outputPath, content, "utf-8");
        console.log(pc.green(`\n  ✓ Generated ${outputFile}`));

        // Generate JSON index if requested
        if (options.json) {
          const jsonContent = generateAgentsIndex(
            { components, tokens, framework, hooks, utilities, commands, existingContext, variants, apiRoutes, envVars, patterns, database, stats, barrels, dependencies },
            content
          );
          const jsonPath = join(targetDir, outputFile.replace(".md", ".index.json"));
          writeFileSync(jsonPath, jsonContent, "utf-8");
          console.log(pc.green(`  ✓ Generated ${outputFile.replace(".md", ".index.json")}`));
        }

        console.log(pc.dim(`    ~${formatTokens(tokenCount)} tokens (${contextUsage}% of 128K context)\n`));
      }
    } catch (error) {
      console.error(pc.red(`\n  Error: ${error instanceof Error ? error.message : error}\n`));
      process.exit(1);
    }
  });

cli.help();
cli.version("0.1.0");
cli.parse();
