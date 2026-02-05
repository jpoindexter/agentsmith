import type { Framework, Utilities, Tokens, Component } from "../types.js";

export interface AntiPattern {
  title: string;
  wrong: string;
  right: string;
  reason: string;
}

export interface AntiPatternsResult {
  patterns: AntiPattern[];
  warnings: string[];
}

/**
 * Generate anti-patterns section based on detected codebase patterns
 * These help AI avoid common mistakes
 */
export function generateAntiPatterns(
  framework: Framework,
  utilities: Utilities,
  tokens: Tokens,
  components: Component[],
  hasDesignSystem: boolean
): AntiPatternsResult {
  const patterns: AntiPattern[] = [];
  const warnings: string[] = [];

  // Design token violations
  if (Object.keys(tokens.colors).length > 0 || hasDesignSystem) {
    patterns.push({
      title: "Hardcoded colors instead of tokens",
      wrong: `className="bg-blue-500 text-white"`,
      right: `className="bg-primary text-primary-foreground"`,
      reason: "Breaks theme switching and design consistency",
    });

    patterns.push({
      title: "Arbitrary color values",
      wrong: `style={{ color: "#3b82f6" }}`,
      right: `className="text-primary"`,
      reason: "Use semantic color tokens from the design system",
    });
  }

  // Component reuse
  if (components.length > 20) {
    const componentNames = components.slice(0, 10).map(c => c.name).join(", ");
    patterns.push({
      title: "Creating new components instead of using existing",
      wrong: `<div className="rounded border p-4">...</div>`,
      right: `<Card><CardContent>...</CardContent></Card>`,
      reason: `This project has ${components.length} components. Check: ${componentNames}...`,
    });

    warnings.push(`⚠️ CHECK EXISTING: ${components.length} components exist. Search before creating new ones.`);
  }

  // cn() utility
  if (utilities.hasCn) {
    patterns.push({
      title: "String concatenation for classes",
      wrong: `className={"btn " + (active ? "btn-active" : "")}`,
      right: `className={cn("btn", active && "btn-active")}`,
      reason: "Use cn() for conditional classes - handles edge cases correctly",
    });
  }

  // Framework-specific
  if (framework.name === "Next.js") {
    patterns.push({
      title: "Using <a> instead of Next.js Link",
      wrong: `<a href="/about">About</a>`,
      right: `<Link href="/about">About</Link>`,
      reason: "Next.js Link enables client-side navigation and prefetching",
    });

    patterns.push({
      title: "Using <img> instead of Next.js Image",
      wrong: `<img src="/photo.jpg" alt="Photo" />`,
      right: `<Image src="/photo.jpg" alt="Photo" width={400} height={300} />`,
      reason: "Next.js Image optimizes images automatically",
    });

    if (framework.router === "App Router") {
      patterns.push({
        title: "Missing 'use client' directive",
        wrong: `// Component with useState but no directive\nconst [state, setState] = useState()`,
        right: `'use client'\n\nconst [state, setState] = useState()`,
        reason: "Client components with hooks need 'use client' at the top",
      });

      patterns.push({
        title: "Unnecessary 'use client'",
        wrong: `'use client'\n\nexport function StaticCard({ title }) { return <div>{title}</div> }`,
        right: `export function StaticCard({ title }) { return <div>{title}</div> }`,
        reason: "Don't add 'use client' to components without interactivity",
      });
    }
  }

  // TypeScript patterns
  if (framework.language === "TypeScript") {
    patterns.push({
      title: "Using 'any' type",
      wrong: `function process(data: any) { ... }`,
      right: `function process(data: UserData) { ... }`,
      reason: "Define proper types - check existing types in /types or /lib",
    });

    patterns.push({
      title: "Missing return types",
      wrong: `async function getUser(id: string) { ... }`,
      right: `async function getUser(id: string): Promise<User> { ... }`,
      reason: "Explicit return types improve code clarity and catch errors",
    });
  }

  // API patterns
  patterns.push({
    title: "Unvalidated API inputs",
    wrong: `const { id } = req.body; // No validation`,
    right: `const { id } = schema.parse(req.body);`,
    reason: "Always validate inputs with Zod or similar",
  });

  patterns.push({
    title: "Exposing internal errors",
    wrong: `catch (e) { return res.json({ error: e.message }) }`,
    right: `catch (e) { console.error(e); return res.json({ error: "Something went wrong" }) }`,
    reason: "Don't expose internal error details to clients",
  });

  // Tailwind patterns
  if (framework.styling === "Tailwind CSS") {
    patterns.push({
      title: "Arbitrary values in Tailwind",
      wrong: `className="w-[137px] mt-[23px]"`,
      right: `className="w-36 mt-6"`,
      reason: "Use Tailwind's spacing scale, not arbitrary values",
    });
  }

  // Mode/design system
  if (utilities.hasMode) {
    patterns.push({
      title: "Not using mode for radius",
      wrong: `className="rounded-lg"`,
      right: `className={cn("...", mode.radius)}`,
      reason: "Use mode.radius for consistent, theme-aware border radius",
    });
  }

  // General warnings
  warnings.push("⚠️ VALIDATE INPUTS: Always validate user input with Zod schemas");
  warnings.push("⚠️ CHECK IMPORTS: Use existing utilities from @/lib/utils");

  if (utilities.hasShadcn) {
    warnings.push("⚠️ SHADCN/UI: Components are in @/components/ui - don't recreate them");
  }

  return { patterns, warnings };
}

export function formatAntiPatterns(result: AntiPatternsResult): string {
  const lines: string[] = [
    "## Common AI Mistakes",
    "",
    "**Avoid these patterns — they're wrong for this codebase:**",
    "",
  ];

  for (const pattern of result.patterns) {
    lines.push(`### ❌ ${pattern.title}`);
    lines.push("");
    lines.push("```tsx");
    lines.push(`// WRONG`);
    lines.push(pattern.wrong);
    lines.push("");
    lines.push(`// RIGHT`);
    lines.push(pattern.right);
    lines.push("```");
    lines.push("");
    lines.push(`*${pattern.reason}*`);
    lines.push("");
  }

  if (result.warnings.length > 0) {
    lines.push("### Warnings");
    lines.push("");
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
