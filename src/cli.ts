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
import { scanGitLog, formatGitLog } from "./scanners/git.js";
import { scanFileTree, formatFileTree } from "./scanners/file-tree.js";
import { scanImports, formatImportGraph } from "./scanners/imports.js";
import { scanTypes, formatTypes } from "./scanners/types.js";
import { generateAntiPatterns, formatAntiPatterns } from "./scanners/anti-patterns.js";
import { generateAgentsMd } from "./generator.js";
import { generateAgentsIndex } from "./json-generator.js";
import { estimateTokens, formatTokens, getContextUsage } from "./utils/tokens.js";
import { detectSecrets } from "./utils/secrets.js";
import { loadConfig } from "./config.js";
import { writeFileSync, existsSync, rmSync, watch } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const cli = cac("agentsmith");

cli
  .command("[dir]", "Generate AGENTS.md from your codebase")
  .option("-o, --output <file>", "Output file path", { default: "AGENTS.md" })
  .option("--dry-run", "Preview without writing file")
  .option("--force", "Overwrite existing AGENTS.md even if it has custom content")
  .option("--compact", "Generate compact output (fewer details, smaller token count)")
  .option("--json", "Also generate AGENTS.index.json for programmatic access")
  .option("--check-secrets", "Scan for potential secrets and warn before output")
  .option("--include-git-log", "Include recent git commits in output")
  .option("--format <format>", "Output format: markdown, xml, or json", { default: "markdown" })
  .option("--remote <url>", "Clone and analyze a remote GitHub repository")
  .option("--compress", "Extract signatures only (reduce tokens by ~40%)")
  .option("--minimal", "Ultra-compact output (~3K tokens) - TL;DR + rules + component names")
  .option("--tree", "Include file tree in output (off by default)")
  .option("--watch", "Watch for file changes and regenerate automatically")
  .action(async (dir: string | undefined, options: { output: string; dryRun?: boolean; force?: boolean; compact?: boolean; json?: boolean; checkSecrets?: boolean; includeGitLog?: boolean; format?: string; remote?: string; compress?: boolean; minimal?: boolean; tree?: boolean; watch?: boolean }) => {
    let targetDir = dir || process.cwd();
    let isRemote = false;
    let tempDir = "";

    // Handle remote repository
    if (options.remote) {
      isRemote = true;
      tempDir = join(process.cwd(), ".agentsmith-temp");
      console.log(pc.cyan("\n  agentsmith\n"));
      console.log(pc.dim(`  Cloning ${options.remote}...\n`));

      try {
        // Clean up any existing temp directory
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true });
        }
        // Clone the repository
        execSync(`git clone --depth 1 ${options.remote} ${tempDir}`, { stdio: "pipe" });
        targetDir = tempDir;
        console.log(pc.green(`  ✓ Cloned repository\n`));
      } catch (error) {
        console.error(pc.red(`  ✗ Failed to clone repository: ${error instanceof Error ? error.message : error}\n`));
        process.exit(1);
      }
    }

    // Load config file if present
    const config = loadConfig(targetDir);
    const outputFile = options.output !== "AGENTS.md" ? options.output : config.output || "AGENTS.md";

    if (!isRemote) {
      console.log(pc.cyan("\n  agentsmith\n"));
    }
    console.log(pc.dim(`  Scanning ${isRemote ? options.remote : targetDir}...\n`));

    try {
      // Run all scanners in parallel
      const excludePatterns = config.exclude || [];
      const [components, tokens, framework, hooks, utilities, commands, existingContext, variants, apiRoutes, envVars, patterns, database, stats, barrels, dependencies, fileTree, importGraph, typeExports] = await Promise.all([
        scanComponents(targetDir, excludePatterns),
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
        scanFileTree(targetDir),
        scanImports(targetDir),
        scanTypes(targetDir),
      ]);

      // Generate anti-patterns based on detected features
      const antiPatterns = generateAntiPatterns(framework, utilities, tokens, components, utilities.hasMode);

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
      if (importGraph.hubFiles.length > 0) {
        console.log(pc.green(`  ✓ Found ${importGraph.hubFiles.length} hub files (most imported)`));
      }
      if (importGraph.circularDeps.length > 0) {
        console.log(pc.yellow(`  ⚠ Found ${importGraph.circularDeps.length} circular dependencies`));
      }
      if (typeExports.propsTypes.length > 0) {
        console.log(pc.green(`  ✓ Found ${typeExports.propsTypes.length} Props types`));
      }

      // Scan git log if requested
      let gitInfo = null;
      if (options.includeGitLog) {
        gitInfo = scanGitLog(targetDir);
        if (gitInfo) {
          console.log(pc.green(`  ✓ Found ${gitInfo.commits.length} recent commits`));
        }
      }

      // Check for existing non-generated AGENTS.md
      if (existingContext.hasAgentsMd && !options.force) {
        console.log(pc.yellow(`\n  ⚠ Found existing ${existingContext.agentsMdPath} with custom content`));
        console.log(pc.yellow(`    Use --force to overwrite\n`));
        return;
      }

      // Generate AGENTS.md content
      let content = generateAgentsMd(
        { components, tokens, framework, hooks, utilities, commands, existingContext, variants, apiRoutes, envVars, patterns, database, stats, barrels, dependencies, fileTree, importGraph, typeExports, antiPatterns },
        { compact: options.compact, compress: options.compress, minimal: options.minimal, includeTree: options.tree, xml: options.format === "xml" }
      );

      // Append git log if included
      if (gitInfo) {
        content += "\n" + formatGitLog(gitInfo);
      }

      // Check for secrets if requested
      if (options.checkSecrets) {
        const secrets = detectSecrets(content);
        if (secrets.length > 0) {
          console.log(pc.yellow(`\n  ⚠ Found ${secrets.length} potential secrets:`));
          for (const s of secrets.slice(0, 5)) {
            console.log(pc.yellow(`    - ${s.type}: ${s.preview} (line ${s.line})`));
          }
          if (secrets.length > 5) {
            console.log(pc.yellow(`    ... and ${secrets.length - 5} more`));
          }
          console.log(pc.yellow(`\n  Review before sharing publicly.\n`));
        } else {
          console.log(pc.green(`  ✓ No secrets detected`));
        }
      }

      // Calculate token estimate
      const tokenCount = estimateTokens(content);
      const contextUsage = getContextUsage(tokenCount);

      // Determine output format and file extension
      const format = options.format || "markdown";
      let finalContent = content;
      let finalOutputFile = outputFile;

      // XML format is now handled directly in generateAgentsMd with xml option
      if (format === "xml") {
        finalOutputFile = outputFile.replace(".md", ".xml");
      } else if (format === "json" && !options.json) {
        // If --format json is used (not --json for index), output as JSON
        const jsonData = {
          version: "1.0",
          generated: new Date().toISOString(),
          content: content,
          stats: { tokens: tokenCount, characters: content.length },
        };
        finalContent = JSON.stringify(jsonData, null, 2);
        finalOutputFile = outputFile.replace(".md", ".json");
      }

      if (options.dryRun) {
        console.log(pc.yellow("\n  Dry run - would generate:\n"));
        console.log(pc.dim("  " + finalOutputFile));
        if (options.json && format === "markdown") {
          console.log(pc.dim("  " + outputFile.replace(".md", ".index.json")));
        }
        console.log(pc.dim(`  ${finalContent.length.toLocaleString()} chars · ~${formatTokens(tokenCount)} tokens (${contextUsage}% of 128K context)\n`));
      } else {
        // Write to original directory if remote, otherwise target directory
        const writeDir = isRemote ? process.cwd() : targetDir;
        const outputPath = join(writeDir, finalOutputFile);
        writeFileSync(outputPath, finalContent, "utf-8");
        console.log(pc.green(`\n  ✓ Generated ${finalOutputFile}`));

        // Generate JSON index if requested (separate from --format json)
        if (options.json && format === "markdown") {
          const jsonContent = generateAgentsIndex(
            { components, tokens, framework, hooks, utilities, commands, existingContext, variants, apiRoutes, envVars, patterns, database, stats, barrels, dependencies, fileTree, importGraph, typeExports, antiPatterns },
            content
          );
          const jsonPath = join(writeDir, outputFile.replace(".md", ".index.json"));
          writeFileSync(jsonPath, jsonContent, "utf-8");
          console.log(pc.green(`  ✓ Generated ${outputFile.replace(".md", ".index.json")}`));
        }

        console.log(pc.dim(`    ~${formatTokens(tokenCount)} tokens (${contextUsage}% of 128K context)\n`));
      }

      // Clean up temp directory if remote
      if (isRemote && tempDir && existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true });
      }

      // Watch mode
      if (options.watch && !isRemote && !options.dryRun) {
        console.log(pc.cyan("  👀 Watching for changes... (Ctrl+C to stop)\n"));

        const srcDir = join(targetDir, "src");
        const componentsDir = join(targetDir, "components");
        const libDir = join(targetDir, "lib");

        let debounceTimer: NodeJS.Timeout | null = null;
        const watchDirs = [srcDir, componentsDir, libDir].filter(d => existsSync(d));

        const regenerate = async () => {
          console.log(pc.dim(`  Regenerating...`));
          // Re-run the action without watch to regenerate
          try {
            execSync(`node ${process.argv[1]} "${targetDir}" -o "${outputFile}" ${options.compact ? "--compact" : ""} ${options.compress ? "--compress" : ""} ${options.minimal ? "--minimal" : ""} ${options.tree ? "--tree" : ""} --force`, {
              stdio: "inherit",
            });
          } catch {
            // Errors are printed by the child process
          }
        };

        for (const watchDir of watchDirs) {
          watch(watchDir, { recursive: true }, (eventType, filename) => {
            if (!filename) return;
            // Ignore non-source files
            if (!/\.(ts|tsx|js|jsx|css|json)$/.test(filename)) return;
            // Ignore test files
            if (/\.(test|spec|stories)\./.test(filename)) return;

            // Debounce regeneration
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(regenerate, 500);
          });
        }

        // Keep process alive
        process.stdin.resume();
      }
    } catch (error) {
      // Clean up temp directory on error
      if (isRemote && tempDir && existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true });
      }
      console.error(pc.red(`\n  Error: ${error instanceof Error ? error.message : error}\n`));
      process.exit(1);
    }
  });

cli.help();
cli.version("1.4.0");
cli.parse();
