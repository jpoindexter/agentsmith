/**
 * Secret Detection Utility
 *
 * Scans content for potential secrets before including in output.
 * Detects common API keys, tokens, and credentials using patterns
 * with unique prefixes to minimize false positives.
 *
 * Supported detections:
 * - AWS keys (AKIA...)
 * - GitHub tokens (gh*_...)
 * - Stripe keys (sk_live_..., sk_test_...)
 * - OpenAI/Anthropic keys
 * - Database URLs
 * - Private keys
 * - JWT tokens
 *
 * @module utils/secrets
 */

/** Detected secret match */
export interface SecretMatch {
  /** Type of secret detected */
  type: string;
  /** Line number where found */
  line: number;
  /** Masked preview of the secret */
  preview: string;
}

/**
 * Secret detection patterns
 * Only includes patterns with unique prefixes to minimize false positives
 */
const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp; requiresContext?: boolean }> = [
  // === High confidence: Unique prefixes ===
  { name: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/g },
  { name: "GitHub Token", pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g },
  { name: "GitHub OAuth", pattern: /gho_[A-Za-z0-9]{36}/g },
  { name: "Stripe Live Key", pattern: /sk_live_[0-9a-zA-Z]{24,}/g },
  { name: "Stripe Test Key", pattern: /sk_test_[0-9a-zA-Z]{24,}/g },
  { name: "Stripe Publishable", pattern: /pk_live_[0-9a-zA-Z]{24,}/g },
  { name: "Slack Token", pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/g },
  { name: "Slack Webhook", pattern: /hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/g },
  { name: "Private Key", pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
  { name: "OpenAI Key", pattern: /sk-[A-Za-z0-9]{32,}T3BlbkFJ[A-Za-z0-9]{32,}/g }, // OpenAI keys have T3BlbkFJ in middle
  { name: "Anthropic Key", pattern: /sk-ant-[A-Za-z0-9-]{40,}/g },
  { name: "SendGrid Key", pattern: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g },
  { name: "Twilio Account SID", pattern: /AC[0-9a-fA-F]{32}/g },
  { name: "Twilio Auth Token", pattern: /(?:twilio[_-]?(?:auth[_-]?)?token|auth[_-]?token)\s*[:=]\s*['"]?[0-9a-fA-F]{32}['"]?/gi, requiresContext: true },
  { name: "Mailchimp Key", pattern: /[0-9a-f]{32}-us[0-9]{1,2}/g },
  { name: "Firebase Key", pattern: /AIza[0-9A-Za-z_-]{35}/g },
  { name: "Google OAuth", pattern: /[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com/g },
  { name: "Heroku API Key", pattern: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g },
  { name: "npm Token", pattern: /npm_[A-Za-z0-9]{36}/g },
  { name: "PyPI Token", pattern: /pypi-[A-Za-z0-9_-]{50,}/g },
  { name: "Discord Token", pattern: /[MN][A-Za-z0-9]{23,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}/g },
  { name: "Discord Webhook", pattern: /discord(?:app)?\.com\/api\/webhooks\/[0-9]+\/[A-Za-z0-9_-]+/g },

  // === Context required: Generic patterns that need assignment context ===
  { name: "AWS Secret Key", pattern: /(?:aws[_-]?secret[_-]?(?:access[_-]?)?key|secret[_-]?access[_-]?key)\s*[:=]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/gi, requiresContext: true },
  { name: "Database URL", pattern: /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|mariadb):\/\/[^\s"'<>]+:[^\s"'<>]+@[^\s"'<>]+/gi },
  { name: "Generic API Key", pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][A-Za-z0-9_-]{20,}['"]/gi, requiresContext: true },
  { name: "Generic Secret", pattern: /(?:secret[_-]?key|client[_-]?secret)\s*[:=]\s*['"][A-Za-z0-9_-]{20,}['"]/gi, requiresContext: true },
  { name: "Private Key Inline", pattern: /(?:private[_-]?key)\s*[:=]\s*['"][A-Za-z0-9+/=]{100,}['"]/gi, requiresContext: true },

  // === JWT: Very specific format ===
  { name: "JWT Token", pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}/g },
];

/**
 * Scans content for potential secrets
 *
 * @param content - Content to scan
 * @returns Array of detected secret matches
 */
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

/** Checks if a matched value is likely a placeholder, not a real secret */
function isLikelyPlaceholder(value: string): boolean {
  const placeholders = [
    // Explicit placeholders
    /^your[_-]?/i,
    /^example/i,
    /^test[_-]?key/i,
    /^demo/i,
    /^placeholder/i,
    /^sample/i,
    /^fake/i,
    /^dummy/i,
    /^mock/i,
    /xxx+/i,
    /^\*+$/,
    /^\.{3,}$/,
    /<[^>]+>/,           // <YOUR_KEY>
    /\{[^}]+\}/,         // {YOUR_KEY}
    /\[[^\]]+\]/,        // [YOUR_KEY]

    // Documentation patterns
    /^sk_test_/i,        // Stripe test keys are ok to show
    /^pk_test_/i,        // Stripe test publishable keys
    /1234567890/,        // Obviously fake numbers
    /^0{8,}/,            // Lots of zeros

    // File paths
    /^[@./]/,
    /\/[a-z-]+\//i,
    /\.(ts|tsx|js|jsx|md|json|css|yml|yaml)$/i,

    // Import-like patterns
    /^@\//,
    /^src\//,
    /^components\//,
    /^lib\//,
    /^node_modules\//,

    // Code patterns (not actual secrets)
    /^(function|const|let|var|export|import|from|return|class|interface|type)/i,

    // Environment variable references (not values)
    /^process\.env\./,
    /^\$\{/,
    /^env\./i,
  ];

  return placeholders.some(p => p.test(value));
}

/** Masks a secret value, showing only first and last 4 characters */
function maskSecret(value: string): string {
  if (value.length <= 8) return "****";
  const start = value.slice(0, 4);
  const end = value.slice(-4);
  return `${start}...${end}`;
}

/** Formats detected secrets as markdown warnings */
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
