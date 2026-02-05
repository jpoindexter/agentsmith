# agentsmith

> Auto-generate AGENTS.md from your codebase

Stop writing AGENTS.md by hand. Let agentsmith scan your codebase and generate it for you.

## What it does

```bash
npx agentsmith

Scanning /Users/you/my-project...
✓ Found 47 components
✓ Found 18 color tokens
✓ Detected Next.js 15 (App Router)

Generated: AGENTS.md
```

agentsmith scans your codebase and generates an AGENTS.md file that works with:
- Cursor
- GitHub Copilot
- Claude Code
- VS Code
- Gemini CLI
- Any AI coding tool that supports AGENTS.md

## Install

```bash
# Run directly (no install)
npx agentsmith

# Or install globally
npm install -g agentsmith
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
```

## What it scans

| Scanner | What it finds |
|---------|---------------|
| **Components** | All React/Vue/Svelte components with export names and import paths |
| **Tokens** | CSS variables and Tailwind config (colors, spacing, radius) |
| **Framework** | Next.js, Remix, Vite, etc. with version and router type |

## Output

The generated AGENTS.md includes:

- **Project Overview** - Framework, language, styling
- **Components** - Full inventory with import paths
- **Design Tokens** - Colors, spacing, radius from your CSS/Tailwind
- **Rules** - Basic rules for AI to follow

## Why?

AI coding tools work better when they understand your codebase. Instead of:
- AI generating `bg-blue-500` when you have `bg-primary`
- AI creating new components when you already have them
- AI ignoring your patterns and conventions

AGENTS.md tells AI what exists and how to use it.

## License

MIT
