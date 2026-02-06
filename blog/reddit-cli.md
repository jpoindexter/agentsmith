# Reddit r/CLI Post

**Title:** agent-smith: Generate context files for AI coding tools from your codebase

**Body:**

After a year of learning to code, I kept hitting the same problem: AI assistants would recreate components I already had, ignore my design tokens, and not follow my project's patterns.

I found [AGENTS.md](https://agents.md) - a standard for giving AI tools context about your codebase. Problem is, you still write it manually. Found some tools that tried to automate it, but none did exactly what I needed.

So I spent a few hours and built agent-smith - a CLI that scans your codebase and auto-generates these context files.

```bash
npx @jpoindexter/agent-smith
```

**What it does:**

- Scans components, hooks, API routes, database models
- Detects frameworks (Next.js, React, etc.)
- Finds design tokens and patterns
- Generates structured context (~10K tokens)

**Output modes:**

- `--compact` - smaller output
- `--minimal` - ultra-compact (~3K tokens)
- `--xml` - XML format
- `--copy` - copy to clipboard
- `--mcp` - run as MCP server

**Why this matters:**

Instead of AI dumping raw code into context (100K+ tokens), agent-smith extracts structured metadata (~10K tokens). It knows your Button has 9 variants, that /api/users requires auth, and that you use cn() for class merging.

Written in TypeScript, zero config, works on any JS/TS codebase.

**Reflection:** A year ago I couldn't have built this. But when you're frustrated by a real problem and have AI tools to help you learn, you can build solutions faster than you think. Took a few hours and learned a ton.

GitHub: https://github.com/jpoindexter/agentsmith

Feedback welcome - what else should it scan for?
