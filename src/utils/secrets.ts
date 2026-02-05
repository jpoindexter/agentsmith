/**
 * Detect potential secrets in content before output
 */

export interface SecretMatch {
  type: string;
  line: number;
  preview: string;
}

// Patterns for common secrets
const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/g },
  // AWS Secret Key - must be near aws_secret or similar context, not just any 40-char string
  { name: "AWS Secret Key", pattern: /(?:aws[_-]?secret[_-]?(?:access[_-]?)?key|secret[_-]?access[_-]?key)\s*[:=]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi },
  { name: "GitHub Token", pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g },
  { name: "GitHub OAuth", pattern: /gho_[A-Za-z0-9]{36}/g },
  { name: "Stripe Key", pattern: /sk_live_[0-9a-zA-Z]{24,}/g },
  { name: "Stripe Test Key", pattern: /sk_test_[0-9a-zA-Z]{24,}/g },
  { name: "Slack Token", pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/g },
  { name: "Private Key", pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
  { name: "OpenAI Key", pattern: /sk-[A-Za-z0-9]{48}/g },
  { name: "Anthropic Key", pattern: /sk-ant-[A-Za-z0-9-]{40,}/g },
  { name: "SendGrid Key", pattern: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g },
  { name: "Twilio Key", pattern: /SK[0-9a-fA-F]{32}/g },
  { name: "Database URL", pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^\s"']+:[^\s"']+@[^\s"']+/g },
  { name: "Generic API Key", pattern: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*['"]?[A-Za-z0-9_-]{20,}['"]?/gi },
  { name: "Generic Secret", pattern: /(?:secret|password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi },
  { name: "Bearer Token", pattern: /Bearer\s+[A-Za-z0-9_-]{20,}/g },
  { name: "JWT Token", pattern: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g },
];

export function detectSecrets(content: string): SecretMatch[] {
  const matches: SecretMatch[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const { name, pattern } of SECRET_PATTERNS) {
      // Reset regex state
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(line)) !== null) {
        // Skip if it looks like a placeholder or example
        const value = match[0];
        if (isLikelyPlaceholder(value)) continue;

        matches.push({
          type: name,
          line: i + 1,
          preview: maskSecret(value),
        });
      }
    }
  }

  return matches;
}

function isLikelyPlaceholder(value: string): boolean {
  const placeholders = [
    /^your[_-]?/i,
    /^example/i,
    /^test[_-]?/i,
    /^demo/i,
    /^placeholder/i,
    /^xxx+$/i,
    /^\*+$/,
    /^\.{3,}$/,
    /<[^>]+>/,
    /\{[^}]+\}/,
    // File paths
    /^[@./]/,
    /\/[a-z-]+\//i,
    /\.(ts|tsx|js|jsx|md|json|css)$/i,
    // Import-like patterns
    /^@\//,
    /^src\//,
    /^components\//,
    // Common words that aren't secrets
    /^(function|const|let|var|export|import|from|return)/i,
  ];

  return placeholders.some(p => p.test(value));
}

function maskSecret(value: string): string {
  if (value.length <= 8) return "****";
  const start = value.slice(0, 4);
  const end = value.slice(-4);
  return `${start}...${end}`;
}

export function formatSecretWarnings(matches: SecretMatch[]): string {
  if (matches.length === 0) return "";

  const lines = [
    "## Security Warnings",
    "",
    "**Potential secrets detected in scanned files:**",
    "",
  ];

  // Group by type
  const byType = new Map<string, SecretMatch[]>();
  for (const match of matches) {
    const existing = byType.get(match.type) || [];
    existing.push(match);
    byType.set(match.type, existing);
  }

  for (const [type, typeMatches] of byType) {
    lines.push(`- **${type}**: ${typeMatches.length} potential match(es)`);
    for (const m of typeMatches.slice(0, 3)) {
      lines.push(`  - Line ${m.line}: \`${m.preview}\``);
    }
    if (typeMatches.length > 3) {
      lines.push(`  - ... and ${typeMatches.length - 3} more`);
    }
  }

  lines.push("");
  lines.push("*Review these before sharing AGENTS.md publicly.*");
  lines.push("");

  return lines.join("\n");
}
