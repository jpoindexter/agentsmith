---
title: Stop Writing AGENTS.md by Hand
published: false
description: A CLI that auto-generates context files for AI coding assistants
tags: ai, webdev, javascript, productivity
---

# Stop Writing AGENTS.md by Hand

If you're using AI coding assistants like Cursor, GitHub Copilot, or Claude Code, you've probably heard of AGENTS.md (or CLAUDE.md, .cursorrules, etc.) - context files that tell AI tools about your project.

The problem? Writing them manually is tedious. And keeping them updated is worse.

So I built [agent-smith](https://github.com/jpoindexter/agentsmith) - a CLI that scans your codebase and generates these files automatically.

## Why I Built This

After a year of learning to code, I kept running into the same frustrating problem over and over: AI assistants would suggest creating components I already had, use hardcoded colors instead of my design tokens, or ignore the patterns I'd carefully established.

I discovered [AGENTS.md](https://agents.md) - a brilliant standard for giving AI tools context about your project. The catch? You still have to write it manually. I found a few tools that tried to automate this, but none did exactly what I needed.

So I spent a few hours and built agent-smith.

## The Problem

Every time I started a new Next.js project, I'd spend 30+ minutes writing context files:

- Listing all my components
- Documenting API routes
- Explaining design patterns
- Writing "don't do this, do this instead" rules

Then the codebase would evolve and the docs would drift out of sync. AI would suggest components that don't exist or patterns I stopped using.

**This happened on every. single. project.**

## The Solution

```bash
npx @jpoindexter/agent-smith
```

That's it. Run it in your project root and it generates a comprehensive AGENTS.md file.

## What It Scans

agent-smith doesn't just dump your file tree. It extracts structured metadata:

- **Components** - names, props, exports, complexity metrics
- **Hooks** - custom hooks with client-only detection
- **API Routes** - endpoints, methods, auth status
- **Database** - Prisma/Drizzle models with relations
- **Design Tokens** - CSS variables, Tailwind config
- **Patterns** - react-hook-form, Zod, Zustand, tRPC detection
- **Import Graph** - hub files, unused components, barrel exports

## Example Output

Instead of generic context, you get actionable rules:

```markdown
## Critical Rules

### 1. USE EXISTING COMPONENTS

// WRONG
<div className="rounded border p-4">...</div>

// RIGHT
<Card><CardContent>...</CardContent></Card>

### 2. USE DESIGN TOKENS

// WRONG
className="bg-blue-500 text-white"

// RIGHT
className="bg-primary text-primary-foreground"
```

AI tools actually follow these because they're specific to your codebase.

## Output Modes

Different contexts need different detail levels:

```bash
# Full output (~10K tokens)
npx @jpoindexter/agent-smith

# Compact (~20% smaller)
npx @jpoindexter/agent-smith --compact

# Minimal (~3K tokens)
npx @jpoindexter/agent-smith --minimal

# XML format
npx @jpoindexter/agent-smith --xml
```

## How It's Different from Repomix/Code2Prompt

Tools like Repomix pack your entire codebase into a single file. Great for one-off prompts, but:

- Dumps raw code without structure
- No semantic understanding
- Uses tons of tokens

agent-smith extracts metadata and generates rules. It knows that `Button` has 9 variants, that `/api/users` requires auth, and that you use `cn()` for class merging.

~10K tokens of structured context beats 100K tokens of raw code.

## Try It

```bash
npx @jpoindexter/agent-smith
```

No install needed. Works with Next.js, React, and any TypeScript codebase.

GitHub: [github.com/jpoindexter/agentsmith](https://github.com/jpoindexter/agentsmith)

## Final Thoughts

A year ago, I couldn't have built this. But that's the power of modern AI tools - they help you learn fast and build solutions to problems you actually have.

If you're learning to code and frustrated by something, build the tool you wish existed. It might only take a few hours, and you'll learn more than any tutorial could teach you.

---

What else should agent-smith scan for? Found a bug? Have a feature idea? Drop a comment or [open an issue](https://github.com/jpoindexter/agentsmith/issues).
