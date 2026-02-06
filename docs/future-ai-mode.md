# Future Feature: AI Interactive Mode

**Status:** Future enhancement - not in scope for v1.x

## Concept

Add `--ai` flag that uses scan results to interactively improve the codebase.

## Flow

```bash
agentsmith --ai
```

1. Normal scan + AGENTS.md generation
2. AI analyzes scan results for opportunities
3. Interactive prompts to fix issues
4. AI generates/fixes code using scan data

## Use Cases

- Generate missing Zod schemas for API routes
- Remove unused components (dead code)
- Refactor high-complexity files
- Add missing TypeScript types/props
- Fix anti-patterns

## Why Later

- Core mission: Generate AGENTS.md (auto agent maker)
- This is scope creep for v1.x
- Need to ship core features first
- Can revisit after v1.1.0 release

## Implementation Notes (when ready)

- Use existing scanners (already detect issues)
- Integrate with Claude API or local LLM
- Make it optional (`--ai` flag)
- Start with one use case (e.g., schema generation)
- Expand from there

---

## MCP Prompts (Also Future)

**Status:** Future enhancement - not in scope for v1.x

### Concept

Add MCP prompts (pre-built templates) for common tasks.

### Examples

```typescript
// Prompt templates AI can use
prompts/generate-zod-schema
  "Generate Zod schema for {route_path} based on existing patterns"

prompts/add-api-route
  "Create new API route at {path} with {method} and validation"

prompts/refactor-complex-file
  "Refactor {file_path} (complexity: {score}) to reduce complexity"

prompts/add-missing-schemas
  "Generate Zod schemas for all routes without validation"

prompts/remove-unused-components
  "Safely remove {component_name} (unused, no imports)"
```

### Why Later

- Core mission: Read codebase, don't modify it
- Code generation is scope creep for v1.x
- Need to ship read-only features first
- Can revisit after v1.1.0 release

### Implementation Notes (when ready)

- Use MCP prompts API
- Templates use scan data to populate variables
- Make them optional (AI can ignore if not needed)
- Start with one category (e.g., schema generation)

---

**Revisit:** After v1.1.0 ships and core features stabilize
