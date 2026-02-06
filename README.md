```
┏━┓┏━╸┏━╸┏┓╻╺┳╸   ┏━┓┏┳┓╻╺┳╸╻ ╻
┣━┫┃╺┓┣╸ ┃┗┫ ┃    ┗━┓┃┃┃┃ ┃ ┣━┫
╹ ╹┗━┛┗━╸╹ ╹ ╹    ┗━┛╹ ╹╹ ╹ ╹ ╹
```

# agentsmith

> Auto-generate AGENTS.md from your codebase

Stop writing AGENTS.md by hand. Run agentsmith and it scans your codebase to generate a comprehensive context file that AI coding tools read automatically.

## What is AGENTS.md?

[AGENTS.md](https://agents.md) is an open standard for giving AI coding assistants context about your project. It's adopted by 60,000+ projects and supported by:

- Cursor
- GitHub Copilot
- Claude Code
- VS Code
- Gemini CLI
- And 20+ more tools

AI tools automatically discover and read `AGENTS.md` files - no configuration needed.

## What agentsmith does

Instead of writing AGENTS.md manually, agentsmith **scans your codebase** and generates it:

```bash
npx @jpoindexter/agent-smith

  agentsmith

  Scanning /Users/you/my-project...

  ✓ Found 279 components
  ✓ Found 5 components with CVA variants
  ✓ Found 37 color tokens
  ✓ Found 14 custom hooks
  ✓ Found 46 API routes
  ✓ Found 87 environment variables
  ✓ Detected Next.js (App Router)
  ✓ Detected shadcn/ui (26 Radix packages)
  ✓ Found cn() utility
  ✓ Found mode/design-system
  ✓ Detected 6 code patterns
  ✓ Found existing CLAUDE.md
  ✓ Found .ai/ folder (12 files)
  ✓ Found prisma schema (28 models)
  ✓ Scanned 1572 files (11.0 MB, 365,599 lines)
  ✓ Found 17 barrel exports
  ✓ Found 15 hub files (most imported)
  ✓ Found 20 Props types
  ✓ Found 40 test files (12% component coverage)

  ✓ Generated AGENTS.md
    ~11K tokens (9% of 128K context)
```

## Install

```bash
# Run directly (no install needed)
npx @jpoindexter/agent-smith

# Or install globally
npm install -g @jpoindexter/agent-smith
```

## Usage

```bash
# Generate AGENTS.md in current directory
agentsmith

# Generate for a specific directory
agentsmith ./my-project

# Preview without writing (dry run)
agentsmith --dry-run

# Custom output file
agentsmith --output CONTEXT.md

# Force overwrite existing file
agentsmith --force
```

## Output Modes

```bash
# Default - comprehensive output (~11K tokens)
agentsmith

# Compact - fewer details (~20% smaller)
agentsmith --compact

# Compress - signatures only (~40% smaller)
agentsmith --compress

# Minimal - ultra-compact (~3K tokens)
agentsmith --minimal

# XML format (industry standard, matches Repomix)
agentsmith --xml

# Include file tree visualization
agentsmith --tree
```

## New in v1.0.0

```bash
# Copy output to clipboard
agentsmith --copy

# Include uncommitted git changes
agentsmith --include-diffs

# Split large repos into chunks
agentsmith --split-output 100kb   # Creates AGENTS-001.md, AGENTS-002.md, etc.

# Include security audit (npm audit)
agentsmith --security

# Monorepo support - generate for each package
agentsmith --monorepo

# Start as MCP server for AI tool integration
agentsmith --mcp
```

## All Options

| Flag | Description |
|------|-------------|
| `-o, --output <file>` | Output file path (default: AGENTS.md) |
| `--dry-run` | Preview without writing file |
| `--force` | Overwrite existing AGENTS.md |
| `--compact` | Fewer details, ~20% smaller |
| `--compress` | Signatures only, ~40% smaller |
| `--minimal` | Ultra-compact, ~3K tokens |
| `--xml` | XML format output |
| `--tree` | Include file tree |
| `--json` | Also generate AGENTS.index.json |
| `--copy` | Copy output to clipboard |
| `--include-diffs` | Include uncommitted git changes |
| `--include-git-log` | Include recent commits |
| `--split-output <size>` | Split into chunks (e.g., 100kb) |
| `--security` | Include npm audit results |
| `--monorepo` | Generate for each workspace package |
| `--mcp` | Start as MCP server |
| `--remote <url>` | Analyze a GitHub repository |
| `--watch` | Auto-regenerate on file changes |
| `--check-secrets` | Scan for secrets before output |

## MCP Server Mode

agentsmith can run as an MCP (Model Context Protocol) server for AI tool integration:

```bash
agentsmith --mcp
```

Exposes these tools to AI assistants:
- `pack_codebase` - Generate AGENTS.md for a directory
- `read_agents` - Read existing AGENTS.md
- `search_components` - Search components by name
- `get_component_info` - Get detailed component info with source

## Configuration

Create `agentsmith.config.json` in your project root:

```json
{
  "output": "AGENTS.md",
  "exclude": [
    "**/test/**",
    "**/stories/**",
    "**/fixtures/**"
  ]
}
```

## What it scans

| Scanner | What it finds |
|---------|---------------|
| **Components** | React components with exports, props, JSDoc, complexity metrics |
| **Variants** | CVA variant options (Button: default, destructive, etc.) |
| **Dependencies** | Component imports (radix, design system, utilities) |
| **Barrels** | Index.ts re-exports for suggested import paths |
| **Tokens** | CSS variables and Tailwind config |
| **Hooks** | Custom hooks with client-only detection |
| **API Routes** | Next.js routes with methods and auth status |
| **Database** | Prisma and Drizzle models with fields and relations |
| **Environment** | Required/optional env vars from .env.example |
| **Patterns** | react-hook-form, Zod, Zustand, tRPC, testing libs |
| **Utilities** | cn(), mode/design-system detection |
| **Framework** | Next.js, Remix, Vite with version and router type |
| **Statistics** | Total files, lines, size, largest files |
| **Existing docs** | CLAUDE.md, .ai/ folder, .cursorrules |
| **File Tree** | Project structure visualization |
| **Import Graph** | Hub files, circular deps, unused components |
| **TypeScript** | Props interfaces, API types, model types |
| **Tests** | Test framework detection, coverage mapping |
| **Security** | npm audit vulnerabilities, outdated packages |

## Output

The generated AGENTS.md includes:

- **TL;DR** - Stack, component count, key imports, high-impact files
- **Getting Started** - Auto-generated setup instructions
- **Project Overview** - Framework, language, styling, statistics
- **Critical Rules** - With WRONG/RIGHT code examples
- **Components** - Full inventory grouped by category
- **Hub Files** - Most imported files (changes have wide impact)
- **Unused Components** - Potentially dead code warnings
- **Preferred Imports** - Barrel imports for cleaner code
- **Custom Hooks** - With client-only markers
- **API Routes** - Grouped by path with methods and auth
- **Database Models** - Fields and relations
- **Environment Variables** - Required vs optional
- **Code Patterns** - Detected patterns with examples
- **Design Tokens** - Color tokens with usage guidance
- **Commands** - npm scripts
- **Security** - Vulnerabilities and outdated packages (with --security)

## Example output

```markdown
# AGENTS.md

> Auto-generated by agentsmith

## TL;DR

- **Stack**: Next.js 16.0.10 + TypeScript 5 + Tailwind 4.0.9 + shadcn/ui
- **Components**: 279 total — USE EXISTING, don't create new
- **Key imports**: `cn()` from `@/lib/utils`, `mode` from `@/design-system`
- **High-impact files**: design-system/index, utils, button, card
- **Database**: prisma with 28 models
- **API**: 46 routes (31 protected)

## Getting Started

```bash
npm install

# Set up environment
cp .env.example .env.local

# Database setup
npm run db:push
npm run db:seed

# Start development
npm run dev
```

## Critical Rules

### 1. USE EXISTING COMPONENTS

```tsx
// WRONG
<div className="rounded border p-4">...</div>

// RIGHT
<Card><CardContent>...</CardContent></Card>
```

### 2. USE DESIGN TOKENS

```tsx
// WRONG
className="bg-blue-500 text-white"

// RIGHT
className="bg-primary text-primary-foreground"
```
```

## Why?

AI coding tools work better when they understand your codebase:

- ❌ AI generates `bg-blue-500` instead of your `bg-primary` token
- ❌ AI creates a new Button when you already have one with 9 variants
- ❌ AI ignores your patterns and conventions

With AGENTS.md:

- ✅ AI knows your components and uses them
- ✅ AI follows your design tokens
- ✅ AI matches your patterns

## Comparison

| Tool | Focus | Approach |
|------|-------|----------|
| **agentsmith** | AGENTS.md generation | Scans codebase, generates context |
| Repomix | Code packing | Packs files into single XML |
| Code2Prompt | Prompt building | Builds prompts from code |

agentsmith is specifically designed for the AGENTS.md standard with opinionated rules about component reuse and design tokens.

## Works great in

- Next.js + Tailwind + shadcn/ui projects
- React apps with component libraries
- Any TypeScript codebase with reusable components

## License

MIT

---

A [theft.studio](https://theft.studio) project
