# Changelog

All notable changes to agentsmith will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-02-06

### Added

#### 🎯 API Schema Extraction
- Extract Zod validation schemas from API routes
- Parse TypeScript type annotations for request/response
- Show field types, validations, and error messages in output
- Support for nested objects, arrays, and optional fields
- Package import resolution (schemas from node_modules)
- Advanced Zod features: `.refine()`, `.transform()`, `.discriminatedUnion()`, `.lazy()`, `.intersection()`
- tRPC procedure detection with input/output schemas

**Why it matters**: AI agents now see API contracts instead of guessing field names and types.

#### 🧠 Cognitive Complexity Analysis
- Implemented Sonar's Cognitive Complexity algorithm
- Replaced cyclomatic complexity (measures paths) with cognitive complexity (measures mental effort)
- Accounts for nesting depth, logical operators, interruptions, and recursion
- Provides AI model recommendations based on codebase complexity

**Why it matters**: More accurate complexity scoring leads to better AI model selection.

#### 🚀 Performance Improvements
- Global schema caching (O(n²) → O(n) for shared schemas)
- Prevents re-parsing the same imported files multiple times
- 20-40% faster on large codebases with shared schema files

#### 🌐 GraphQL Support
- Extract GraphQL schema definitions from `.graphql` and `.gql` files
- Parse ObjectTypeDefinition, InputObjectTypeDefinition, EnumTypeDefinition
- Display GraphQL types in dedicated output section

#### 🤖 Provider-Agnostic AI Recommendations
- Replaced Claude-specific model names (Haiku/Sonnet/Opus) with universal effort levels
- Three tiers: **Minimal effort** (fast, low-cost), **Standard effort** (balanced), **Maximum effort** (most capable)
- Works for all AI providers: Claude, GPT, Gemini, etc.
- Recommendations won't break when model names change

**Why it matters**: agentsmith output now works for any AI assistant, not just Claude.

### Fixed
- Import scanner now filters out comments and template strings
- No more fake imports from JSDoc examples or generated code
- Cleaner Key Dependencies section in output

### Changed
- AI recommendations section now shows effort levels instead of model names
- More accurate complexity scoring for files with high cognitive load
- Improved schema extraction accuracy from 85% to 95%+ with AST parsing

## [1.0.1] - 2025-01-15

### Fixed
- Initial bug fixes and stability improvements

## [1.0.0] - 2025-01-10

### Added
- Initial release
- Component scanning with CVA variants
- API route detection with auth status
- Database model extraction (Prisma/Drizzle)
- Environment variable detection
- Design token scanning
- Custom hook detection
- Import graph analysis
- TypeScript type extraction
- Test coverage mapping
- MCP server mode
- Multiple output formats (markdown, XML, JSON)
- Monorepo support
- Security audit integration
