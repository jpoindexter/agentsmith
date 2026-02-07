#!/usr/bin/env bash
# sync-version.sh - Syncs version from package.json to all hardcoded fallbacks
#
# Run manually: ./scripts/sync-version.sh
# Or automatically via npm version hook (see package.json)

set -e

VERSION=$(node -p "require('./package.json').version")

echo "Syncing version to $VERSION..."

# Update cli.ts fallback version
sed -i '' "s/let packageVersion = \"[0-9]*\.[0-9]*\.[0-9]*\"/let packageVersion = \"$VERSION\"/" src/cli.ts

# Update mcp-server.ts fallback version
sed -i '' "s/let mcpVersion = \"[0-9]*\.[0-9]*\.[0-9]*\"/let mcpVersion = \"$VERSION\"/" src/mcp-server.ts

echo "Version synced to $VERSION in:"
echo "  - src/cli.ts (fallback)"
echo "  - src/mcp-server.ts (fallback)"
