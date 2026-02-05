#!/usr/bin/env node

import { cac } from "cac";
import pc from "picocolors";
import { scanComponents } from "./scanners/components.js";
import { scanTokens } from "./scanners/tokens.js";
import { detectFramework } from "./scanners/framework.js";
import { generateAgentsMd } from "./generator.js";
import { writeFileSync } from "fs";
import { join } from "path";

const cli = cac("agentsmith");

cli
  .command("[dir]", "Generate AGENTS.md from your codebase")
  .option("-o, --output <file>", "Output file path", { default: "AGENTS.md" })
  .option("--dry-run", "Preview without writing file")
  .action(async (dir: string | undefined, options: { output: string; dryRun?: boolean }) => {
    const targetDir = dir || process.cwd();

    console.log(pc.cyan("\n  agentsmith\n"));
    console.log(pc.dim(`  Scanning ${targetDir}...\n`));

    try {
      // Run all scanners
      const [components, tokens, framework] = await Promise.all([
        scanComponents(targetDir),
        scanTokens(targetDir),
        detectFramework(targetDir),
      ]);

      console.log(pc.green(`  ✓ Found ${components.length} components`));
      console.log(pc.green(`  ✓ Found ${Object.keys(tokens.colors).length} color tokens`));
      console.log(pc.green(`  ✓ Detected ${framework.name} (${framework.router || "unknown router"})`));

      // Generate AGENTS.md content
      const content = generateAgentsMd({ components, tokens, framework });

      if (options.dryRun) {
        console.log(pc.yellow("\n  Dry run - would generate:\n"));
        console.log(pc.dim("  " + options.output));
        console.log(pc.dim(`  (${content.length} characters)\n`));
      } else {
        const outputPath = join(targetDir, options.output);
        writeFileSync(outputPath, content, "utf-8");
        console.log(pc.green(`\n  ✓ Generated ${options.output}\n`));
      }
    } catch (error) {
      console.error(pc.red(`\n  Error: ${error instanceof Error ? error.message : error}\n`));
      process.exit(1);
    }
  });

cli.help();
cli.version("0.1.0");
cli.parse();
