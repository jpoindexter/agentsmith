# AGENTS.md Example

> This shows what agentsmith v1.1.0 generates with new features

## API Routes with Schemas

42 API endpoints (8 with schemas):

### Contact

- `POST` `/api/contact`
  - **Request**: contactSchema { name: string (max: 100, min: 1, "Name is required"), email: string (email: Invalid email address), subject: "sales" | "support" | "billing" | "feature", message: string (max: 5000, min: 10), website?: string, +1 more }
  - **Response**: { success: boolean, message: string }

### AI

- `POST` `/api/ai/generate-form` 🔒
  - **Request**: generatedFormSchema { name: string, description: string, fields: unknown[] (min: 1), submitLabel: string (default: "Submit") }
  - **Response**: { formId: string, schema: object }

### Users

- `GET` `/api/users/:id` 🔒
  - **Response**: { id: string (uuid), name: string, email: string, createdAt: Date }

## GraphQL Schemas

3 GraphQL types:

- **User** — id: ID!, name: String!, email: String!, posts: [Post!]!, +2 more
- **Post** — id: ID!, title: String!, content: String!, author: User!, +1 more
- **Comment** — id: ID!, text: String!, author: User!, post: Post!

## AI Assistant Configuration

**Recommended Settings Based on Codebase Complexity:**

- **For simple tasks** (formatting, typing): minimal effort (fast, low-cost models)
- **For complex tasks** (refactoring, architecture): standard effort (balanced cost/capability)

**Complexity by Area:**

- 🔴 **Database** (46 files, complexity: 51/100)
  - Recommended: Maximum effort (most capable model)
  - Characteristics: high cognitive complexity, complex regex patterns, large files
- 🟡 **API Routes** (77 files, complexity: 34/100)
  - Recommended: Standard effort (balanced model)
  - Characteristics: complex regex patterns, moderate cognitive complexity
- 🟢 **Utilities** (129 files, complexity: 25/100)
  - Recommended: Minimal effort (fast, low-cost model)
  - Characteristics: simple logic, small files

**High Complexity Files** (use most capable model with extended thinking):

- `src/lib/ai/cost.ts` (647 lines, score: 75/100)
  - large file (>500 lines), high cognitive complexity, heavy async logic, complex regex patterns
- `src/components/theme/theme-playground.tsx` (1194 lines, score: 75/100)
  - large file (>500 lines), high cognitive complexity, complex types
- `src/lib/ai/index.ts` (523 lines, score: 75/100)
  - large file (>500 lines), high cognitive complexity, heavy async logic

---

**New in v1.1.0:**
- ✨ API schema extraction (Zod, TypeScript, tRPC)
- ✨ GraphQL support
- ✨ Cognitive complexity analysis
- ✨ Provider-agnostic AI recommendations
- ✨ Package import resolution
