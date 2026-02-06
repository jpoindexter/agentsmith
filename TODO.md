# TODO - Pre-Release Cleanup

Tasks to complete before v1.1.0 release:

## Code Quality

- [ ] **Remove AI-generated comments** - Replace with real comments or delete
  - Search for generic AI comments like "Helper function", "Main function", etc.
  - Keep only useful comments that explain WHY, not WHAT
  - Delete obvious comments that just restate the code

- [ ] **Remove TODO comments** - No TODO/FIXME/STUB in codebase
  - Search: `grep -r "TODO\|FIXME\|STUB\|XXX\|HACK" src/`
  - Either fix the issue or remove the comment
  - Don't ship unfinished code markers

- [ ] **Remove stub code** - No placeholder/unimplemented functions
  - Check for functions that just `return null` or `throw new Error("Not implemented")`
  - Either implement properly or remove entirely

- [ ] **Remove dead code** - Delete unused imports, functions, variables
  - Run linter to find unused code
  - Remove commented-out code blocks
  - Clean up debug console.logs

## Verification

- [ ] **Run full typecheck** - `npm run typecheck` (should pass)
- [ ] **Build succeeds** - `npm run build` (no errors)
- [ ] **Smoke test MCP server** - Verify 16 tools + 5 resources work
- [ ] **Test on real project** - Run on fabrk-dev, verify output quality

## Final Checks

- [ ] All commits have meaningful messages
- [ ] CHANGELOG.md is up to date
- [ ] README.md shows current features
- [ ] package.json version is correct (1.1.0)
- [ ] No sensitive data in code (API keys, tokens, etc.)

---

**Complete these before:** `git tag v1.1.0 && git push --tags`
