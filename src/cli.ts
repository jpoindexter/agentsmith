#!/usr/bin/env node

/**
 * agentsmith CLI
 *
 * Main entry point for the agentsmith command-line tool.
 * Scans codebases and generates AGENTS.md files with comprehensive
 * context for AI coding assistants.
 *
 * @example
 * ```bash
 * # Basic usage
 * npx agentsmith
 *
 * # With options
 * npx agentsmith --compact --copy
 * ```
 */

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
import { analyzeComplexity } from "./scanners/complexity.js";
import { scanBarrels } from "./scanners/barrels.js";
import { scanDependencies } from "./scanners/dependencies.js";
import { scanGitLog, formatGitLog, getGitDiff, formatGitDiff } from "./scanners/git.js";
import { scanFileTree, formatFileTree } from "./scanners/file-tree.js";
import { scanImports, formatImportGraph } from "./scanners/imports.js";
import { scanTypes, formatTypes } from "./scanners/types.js";
import { generateAntiPatterns, formatAntiPatterns } from "./scanners/anti-patterns.js";
import { scanTestCoverage } from "./scanners/tests.js";
import { scanSecurity, formatSecurityAudit } from "./scanners/security.js";
import { detectMonorepo, formatMonorepoOverview } from "./scanners/monorepo.js";
import { scanGraphQL } from "./scanners/graphql.js";
import { generateAgentsMd } from "./generator.js";
import { generateAgentsIndex } from "./json-generator.js";
import { validateGitUrl, escapeShellPath } from "./utils/shell.js";
import { estimateTokens, formatTokens, getContextUsage } from "./utils/tokens.js";
import { detectSecrets } from "./utils/secrets.js";
import { parseSize, splitContent, getSplitFilenames } from "./utils/split.js";
import { loadConfig } from "./config.js";
import { writeFileSync, existsSync, rmSync, watch } from "fs";
import { join, relative } from "path";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join as pathJoin } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to read package.json from multiple possible locations
let packageVersion = "1.1.2"; // fallback
try {
  // When running from dist in development or from installed package
  const packageJson = JSON.parse(readFileSync(pathJoin(__dirname, "../package.json"), "utf-8"));
  packageVersion = packageJson.version;
} catch {
  try {
    // When dist is at root level in published package
    const packageJson = JSON.parse(readFileSync(pathJoin(__dirname, "package.json"), "utf-8"));
    packageVersion = packageJson.version;
  } catch {
    // Use fallback version
  }
}

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
  .option("--xml", "Output in XML format (industry standard)")
  .option("--remote <url>", "Clone and analyze a remote GitHub repository")
  .option("--compress", "Extract signatures only (reduce tokens by ~40%)")
  .option("--minimal", "Ultra-compact output (~3K tokens) - TL;DR + rules + component names")
  .option("--tree", "Include file tree in output (off by default)")
  .option("--copy", "Copy output to clipboard")
  .option("--include-diffs", "Include uncommitted git changes")
  .option("--split-output <size>", "Split output into chunks (e.g., 100kb, 500kb)")
  .option("--security", "Include security audit (npm audit) in output")
  .option("--monorepo", "Generate AGENTS.md for each package in monorepo")
  .option("--mcp", "Start as MCP server (for AI tool integration)")
  .option("--watch", "Watch for file changes and regenerate automatically")
  .action(async (dir: string | undefined, options: { output: string; dryRun?: boolean; force?: boolean; compact?: boolean; json?: boolean; checkSecrets?: boolean; includeGitLog?: boolean; xml?: boolean; remote?: string; compress?: boolean; minimal?: boolean; tree?: boolean; copy?: boolean; includeDiffs?: boolean; splitOutput?: string; security?: boolean; monorepo?: boolean; mcp?: boolean; watch?: boolean }) => {
    // Handle MCP server mode
    if (options.mcp) {
      const { startMcpServer } = await import("./mcp-server.js");
      await startMcpServer();
      return;
    }

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
        // Validate and sanitize git URL to prevent command injection
        const safeUrl = validateGitUrl(options.remote);
        const safeTempDir = escapeShellPath(tempDir);

        // Clean up any existing temp directory
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true });
        }
        // Clone the repository
        execSync(`git clone --depth 1 ${safeUrl} ${safeTempDir}`, { stdio: "pipe" });
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

    // Handle monorepo mode
    if (options.monorepo) {
      const monorepoInfo = await detectMonorepo(targetDir);
      if (monorepoInfo.isMonorepo && monorepoInfo.packages.length > 0) {
        console.log(pc.dim(`  Detected ${monorepoInfo.type} monorepo with ${monorepoInfo.packages.length} packages\n`));

        // Generate AGENTS.md for each package
        for (const pkg of monorepoInfo.packages) {
          console.log(pc.dim(`  Scanning ${pkg.name}...`));

          if (options.dryRun) {
            console.log(pc.yellow(`    Would generate: ${pkg.relativePath}/AGENTS.md`));
          } else {
            // Recursively call the main logic for each package
            const pkgConfig = loadConfig(pkg.path);
            const pkgExcludePatterns = pkgConfig.exclude || [];

            const [pkgComponents, pkgTokens, pkgFramework, pkgHooks, pkgUtilities, pkgCommands, pkgExistingContext, pkgVariants, pkgApiRoutes, pkgEnvVars, pkgPatterns, pkgDatabase, pkgStats, pkgBarrels, pkgDependencies, pkgFileTree, pkgImportGraph, pkgTypeExports, pkgGraphQLSchemas] = await Promise.all([
              scanComponents(pkg.path, pkgExcludePatterns),
              scanTokens(pkg.path),
              detectFramework(pkg.path),
              scanHooks(pkg.path),
              scanUtilities(pkg.path),
              scanCommands(pkg.path),
              scanExistingContext(pkg.path),
              scanVariants(pkg.path),
              scanApiRoutes(pkg.path),
              scanEnvVars(pkg.path),
              scanPatterns(pkg.path),
              scanDatabase(pkg.path),
              scanStats(pkg.path),
              scanBarrels(pkg.path),
              scanDependencies(pkg.path),
              scanFileTree(pkg.path),
              scanImports(pkg.path),
              scanTypes(pkg.path),
              scanGraphQL(pkg.path),
            ]);

            const pkgAntiPatterns = generateAntiPatterns(pkgFramework, pkgUtilities, pkgTokens, pkgComponents, pkgUtilities.hasMode);
            const pkgTestCoverage = await scanTestCoverage(pkg.path, pkgComponents);

            const pkgContent = generateAgentsMd(
              { components: pkgComponents, tokens: pkgTokens, framework: pkgFramework, hooks: pkgHooks, utilities: pkgUtilities, commands: pkgCommands, existingContext: pkgExistingContext, variants: pkgVariants, apiRoutes: pkgApiRoutes, envVars: pkgEnvVars, patterns: pkgPatterns, database: pkgDatabase, stats: pkgStats, barrels: pkgBarrels, dependencies: pkgDependencies, fileTree: pkgFileTree, importGraph: pkgImportGraph, typeExports: pkgTypeExports, antiPatterns: pkgAntiPatterns, testCoverage: pkgTestCoverage, graphqlSchemas: pkgGraphQLSchemas },
              { compact: options.compact, compress: options.compress, minimal: options.minimal }
            );

            const pkgOutputPath = join(pkg.path, "AGENTS.md");
            writeFileSync(pkgOutputPath, pkgContent, "utf-8");
            const pkgTokenCount = estimateTokens(pkgContent);
            console.log(pc.green(`    ✓ ${pkg.relativePath}/AGENTS.md (~${formatTokens(pkgTokenCount)} tokens)`));
          }
        }

        // Generate root AGENTS.md with monorepo overview
        if (!options.dryRun) {
          const rootLines = [
            "# AGENTS.md",
            "",
            "> Auto-generated by [agentsmith](https://github.com/jpoindexter/agentsmith)",
            "",
            formatMonorepoOverview(monorepoInfo),
          ];
          const rootContent = rootLines.join("\n");
          const rootOutputPath = join(targetDir, "AGENTS.md");
          writeFileSync(rootOutputPath, rootContent, "utf-8");
          console.log(pc.green(`\n  ✓ Generated root AGENTS.md`));
        } else {
          console.log(pc.yellow(`\n  Would generate: AGENTS.md (root overview)`));
        }

        console.log("");
        return;
      } else {
        console.log(pc.yellow(`  Not a monorepo, proceeding with standard scan...\n`));
      }
    }

    console.log(pc.dim(`  Scanning ${isRemote ? options.remote : targetDir}...\n`));

    try {
      // Run types scanner first to enable schema resolution in API routes
      const excludePatterns = config.exclude || [];
      const typeExports = await scanTypes(targetDir);

      // Run remaining scanners in parallel
      const [components, tokens, framework, hooks, utilities, commands, existingContext, variants, apiRoutes, envVars, patterns, database, stats, barrels, dependencies, fileTree, importGraph, graphqlSchemas] = await Promise.all([
        scanComponents(targetDir, excludePatterns),
        scanTokens(targetDir),
        detectFramework(targetDir),
        scanHooks(targetDir),
        scanUtilities(targetDir),
        scanCommands(targetDir),
        scanExistingContext(targetDir),
        scanVariants(targetDir),
        scanApiRoutes(targetDir, typeExports.types),
        scanEnvVars(targetDir),
        scanPatterns(targetDir),
        scanDatabase(targetDir),
        scanStats(targetDir),
        scanBarrels(targetDir),
        scanDependencies(targetDir),
        scanFileTree(targetDir),
        scanImports(targetDir),
        scanGraphQL(targetDir),
      ]);

      // Generate anti-patterns based on detected features
      const antiPatterns = generateAntiPatterns(framework, utilities, tokens, components, utilities.hasMode);

      // Scan test coverage (needs components list)
      const testCoverage = await scanTestCoverage(targetDir, components);

      // Scan security (optional, only when --security flag)
      const securityAudit = options.security ? await scanSecurity(targetDir) : null;

      // Analyze complexity and generate AI recommendations
      const aiRecommendations = await analyzeComplexity(targetDir);

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
      if (graphqlSchemas && graphqlSchemas.size > 0) {
        console.log(pc.green(`  ✓ Found ${graphqlSchemas.size} GraphQL schemas`));
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
      if (importGraph.unusedFiles.length > 0) {
        console.log(pc.yellow(`  ⚠ Found ${importGraph.unusedFiles.length} potentially unused components`));
      }
      if (typeExports.propsTypes.length > 0) {
        console.log(pc.green(`  ✓ Found ${typeExports.propsTypes.length} Props types`));
      }
      if (testCoverage.testFiles.length > 0) {
        console.log(pc.green(`  ✓ Found ${testCoverage.testFiles.length} test files (${testCoverage.coverage}% component coverage)`));
      }
      if (securityAudit) {
        const v = securityAudit.vulnerabilities;
        if (v.total > 0) {
          const parts: string[] = [];
          if (v.critical > 0) parts.push(`${v.critical} critical`);
          if (v.high > 0) parts.push(`${v.high} high`);
          if (v.moderate > 0) parts.push(`${v.moderate} moderate`);
          if (v.low > 0) parts.push(`${v.low} low`);
          console.log(pc.yellow(`  ⚠ Security: ${parts.join(", ")} vulnerabilities`));
        } else if (!securityAudit.auditError) {
          console.log(pc.green(`  ✓ Security: No vulnerabilities found`));
        }
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
        { components, tokens, framework, hooks, utilities, commands, existingContext, variants, apiRoutes, envVars, patterns, database, stats, barrels, dependencies, fileTree, importGraph, typeExports, antiPatterns, testCoverage, securityAudit: securityAudit || undefined, aiRecommendations, graphqlSchemas },
        { compact: options.compact, compress: options.compress, minimal: options.minimal, includeTree: options.tree, xml: options.xml }
      );

      // Append git log if included
      if (gitInfo) {
        content += "\n" + formatGitLog(gitInfo);
      }

      // Append git diff if included
      if (options.includeDiffs) {
        const diff = getGitDiff(targetDir);
        if (diff) {
          content += "\n" + formatGitDiff(diff);
          console.log(pc.green(`  ✓ Included uncommitted changes (${(diff.length / 1024).toFixed(1)}KB)`));
        }
      }

      // Append security audit if included
      if (securityAudit && !options.minimal && !options.xml) {
        content += "\n" + formatSecurityAudit(securityAudit);
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

      // Determine output file extension based on format
      let finalContent = content;
      let finalOutputFile = options.xml ? outputFile.replace(".md", ".xml") : outputFile;

      if (options.dryRun) {
        console.log(pc.yellow("\n  Dry run - would generate:\n"));
        if (options.splitOutput) {
          try {
            const maxBytes = parseSize(options.splitOutput);
            const { chunks } = splitContent(finalContent, maxBytes);
            const filenames = getSplitFilenames(finalOutputFile, chunks.length);
            for (const filename of filenames) {
              console.log(pc.dim("  " + filename));
            }
          } catch (err) {
            console.log(pc.dim("  " + finalOutputFile));
            console.log(pc.yellow(`  ⚠ Split error: ${err instanceof Error ? err.message : 'unknown'}`));
          }
        } else {
          console.log(pc.dim("  " + finalOutputFile));
        }
        if (options.json && !options.xml) {
          console.log(pc.dim("  " + outputFile.replace(".md", ".index.json")));
        }
        console.log(pc.dim(`  ${finalContent.length.toLocaleString()} chars · ~${formatTokens(tokenCount)} tokens (${contextUsage}% of 128K context)\n`));
      } else {
        // Write to original directory if remote, otherwise target directory
        const writeDir = isRemote ? process.cwd() : targetDir;

        // Handle --split-output
        if (options.splitOutput) {
          try {
            const maxBytes = parseSize(options.splitOutput);
            const { chunks, totalSize } = splitContent(finalContent, maxBytes);
            const filenames = getSplitFilenames(finalOutputFile, chunks.length);

            console.log(pc.green(`\n  ✓ Split output into ${chunks.length} files:`));
            for (let i = 0; i < chunks.length; i++) {
              const outputPath = join(writeDir, filenames[i]);
              writeFileSync(outputPath, chunks[i], "utf-8");
              const chunkTokens = estimateTokens(chunks[i]);
              console.log(pc.green(`    ✓ ${filenames[i]} (~${formatTokens(chunkTokens)} tokens)`));
            }
          } catch (err) {
            console.log(pc.red(`\n  ✗ Split error: ${err instanceof Error ? err.message : 'unknown'}`));
            // Fall back to single file
            const outputPath = join(writeDir, finalOutputFile);
            writeFileSync(outputPath, finalContent, "utf-8");
            console.log(pc.green(`  ✓ Generated ${finalOutputFile} (single file fallback)`));
          }
        } else {
          const outputPath = join(writeDir, finalOutputFile);
          writeFileSync(outputPath, finalContent, "utf-8");
          console.log(pc.green(`\n  ✓ Generated ${finalOutputFile}`));
        }

        // Generate JSON index if requested (not with --xml)
        if (options.json && !options.xml) {
          const jsonContent = generateAgentsIndex(
            { components, tokens, framework, hooks, utilities, commands, existingContext, variants, apiRoutes, envVars, patterns, database, stats, barrels, dependencies, fileTree, importGraph, typeExports, antiPatterns, testCoverage, graphqlSchemas },
            content
          );
          const jsonPath = join(writeDir, outputFile.replace(".md", ".index.json"));
          writeFileSync(jsonPath, jsonContent, "utf-8");
          console.log(pc.green(`  ✓ Generated ${outputFile.replace(".md", ".index.json")}`));
        }

        console.log(pc.dim(`    ~${formatTokens(tokenCount)} tokens (${contextUsage}% of 128K context)\n`));

        // Warn if AGENTS.md is tracked in git
        try {
          const outputPath = join(writeDir, finalOutputFile);
          const relativePath = relative(writeDir, outputPath);
          execSync(`git ls-files --error-unmatch "${relativePath}"`, { cwd: writeDir, stdio: "pipe" });

          // If we get here, the file is tracked
          console.log(pc.yellow(`  ⚠ WARNING: ${finalOutputFile} is tracked in git!`));
          console.log(pc.yellow(`    Add to .gitignore to prevent accidentally committing secrets:\n`));
          console.log(pc.dim(`    echo "AGENTS.md" >> .gitignore\n`));
        } catch {
          // File not tracked or not a git repo - this is good!
        }

        // Copy to clipboard if requested
        if (options.copy) {
          try {
            const { default: clipboard } = await import('clipboardy');
            await clipboard.write(finalContent);
            console.log(pc.green(`  ✓ Copied to clipboard`));
          } catch (err) {
            console.log(pc.yellow(`  ⚠ Could not copy to clipboard: ${err instanceof Error ? err.message : 'unknown error'}`));
          }
        }
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
cli.version(packageVersion);
cli.parse();
