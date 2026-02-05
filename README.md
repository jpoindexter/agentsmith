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
npx agentsmith

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

  ✓ Generated AGENTS.md
    ~9.9K tokens (8% of 128K context)
```

## Install

```bash
# Run directly (no install needed)
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

# Force overwrite existing file
agentsmith --force

# Generate compact output (fewer details, ~20% smaller)
agentsmith --compact

# Also generate JSON index for programmatic access
agentsmith --json

# Combine options
agentsmith --compact --json --force
```

## Configuration

Create `agentsmith.config.json` in your project root for customization:

```json
{
  "output": "AGENTS.md",
  "showProps": true,
  "showDescriptions": true,
  "exclude": ["**/test/**", "**/stories/**"]
}
```

## What it scans

| Scanner | What it finds |
|---------|---------------|
| **Components** | React components with exports, props, and JSDoc descriptions |
| **Variants** | CVA variant options (Button: default, destructive, etc.) |
| **Dependencies** | Component imports (radix, design system, utilities) |
| **Barrels** | Index.ts re-exports for suggested import paths |
| **Tokens** | CSS variables and Tailwind config |
| **Hooks** | Custom hooks with client-only detection |
| **API Routes** | Next.js routes grouped by path, with methods and auth status |
| **Database** | Prisma models with fields and relations |
| **Environment** | Required/optional env vars from .env.example |
| **Patterns** | react-hook-form, Zod, Zustand, tRPC, testing libs |
| **Utilities** | cn(), mode/design-system detection |
| **Framework** | Next.js, Remix, Vite with version and router type |
| **Statistics** | Total files, lines, size, largest files |
| **Existing docs** | CLAUDE.md, .ai/ folder, .cursorrules |

## Output

The generated AGENTS.md includes:

- **Project Overview** - Framework, language, styling, file count, line count
- **Codebase Statistics** - Largest files in the project
- **Critical Rules** - Non-negotiable rules (use existing components, use tokens)
- **Components** - Full inventory with props and JSDoc descriptions
- **Preferred Imports** - Barrel imports for cleaner code
- **Component Dependencies** - What each component imports
- **Component Variants** - CVA options for each component
- **Custom Hooks** - With client-only markers
- **API Routes** - Grouped by path (Users, Auth, Admin, etc.) with methods and auth status
- **Database Models** - Prisma models with fields and relations
- **Environment Variables** - Required vs optional
- **Code Patterns** - Detected patterns with usage examples
- **Design Tokens** - Color tokens with usage guidance
- **Commands** - npm scripts for dev, build, test, db, etc.

## Token Counting

agentsmith estimates the token count of generated output:

```bash
agentsmith --dry-run

  ✓ Generated AGENTS.md
    ~9.9K tokens (8% of 128K context)
```

This helps you understand how much of your AI's context window the file uses.

## Compact Mode

For large projects, use `--compact` to reduce output size:

```bash
agentsmith --compact

# Normal:  ~9.9K tokens
# Compact: ~7.8K tokens (21% smaller)
```

Compact mode:
- Limits props to top 5 per component
- Skips JSDoc descriptions
- Omits codebase statistics
- Skips dependency graph

## JSON Index

Generate a machine-readable index alongside AGENTS.md:

```bash
agentsmith --json

  ✓ Generated AGENTS.md
  ✓ Generated AGENTS.index.json
```

The JSON index includes structured data for all components, hooks, routes, and models - useful for building tooling on top of agentsmith.

## Example output

```markdown
# AGENTS.md

## Project Overview

| | |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript |
| **UI Library** | shadcn/ui (26 Radix packages) |
| **Components** | 279 |
| **Codebase** | 1,572 files, 365,599 lines |

## Codebase Statistics

### Largest Files

- `src/generated/prisma/models/User.ts` (6088 lines)
- `src/components/ui/form.tsx` (847 lines)

## Critical Rules

1. **USE EXISTING COMPONENTS** — Check the list below before creating ANYTHING new
2. **USE DESIGN TOKENS** — Never hardcode colors, use semantic tokens
3. **USE `cn()`** — Always use cn() for conditional classes

## Components

### UI Components (62)

- `Button` — `@/components/ui/button`
  - Props: variant, size, asChild, disabled
  - Variants: default, destructive, outline, ghost, link

## Preferred Imports

Use barrel imports instead of importing from individual files:

```typescript
import { Button, Card, Input } from "@/components/ui";
```

## API Routes

### Auth

- `POST` `/api/auth/login`
- `POST` `/api/auth/register`
- `GET` `/api/auth/verify-email`

### Users

- `GET` `/api/users` 🔒
- `POST` `/api/users` 🔒
- `DELETE` `/api/users/:id` 🔒

## Database Models

- **User** — id, email, name, createdAt
  - Relations: posts, sessions
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

| Approach | Effort | Coverage |
|----------|--------|----------|
| Write AGENTS.md manually | High | Whatever you remember |
| Ask AI to scaffold it | Medium | Basic structure |
| **Run agentsmith** | Zero | Comprehensive scan |

## Works great with

- [Fabrk](https://fabrk.dev) - SaaS boilerplate with 62+ components
- Any Next.js + Tailwind + shadcn/ui project
- Any React project with components in `/components`

## License

MIT
