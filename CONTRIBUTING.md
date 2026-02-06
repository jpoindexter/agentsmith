# Contributing to agentsmith

Thanks for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/jpoindexter/agentsmith.git
cd agentsmith
npm install
npm run dev   # Watch mode
```

## Making Changes

1. Fork the repo
2. Create a branch: `git checkout -b my-feature`
3. Make your changes
4. Test locally: `node dist/cli.js --dry-run`
5. Commit: `git commit -m "feat: add my feature"`
6. Push: `git push origin my-feature`
7. Open a PR

## Commit Messages

Use conventional commits:
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `chore:` maintenance

## Code Style

- TypeScript strict mode
- No external runtime dependencies unless necessary
- Keep it simple

## Testing

```bash
npm run build
node dist/cli.js /path/to/test-project --dry-run
```

## Questions?

Open an issue or discussion.
