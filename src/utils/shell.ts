/**
 * Shell Command Sanitization Utility
 *
 * Provides safe wrappers for executing shell commands with user input.
 * Prevents command injection by properly escaping arguments.
 *
 * @module utils/shell
 */

/**
 * Escapes a string for safe use in shell commands
 * Wraps in single quotes and escapes any existing single quotes
 *
 * @param arg - Argument to escape
 * @returns Safely escaped argument
 *
 * @example
 * escapeShellArg("user's file.txt") // => 'user'\''s file.txt'
 * escapeShellArg("normal.txt")      // => 'normal.txt'
 */
export function escapeShellArg(arg: string): string {
  // Single quotes prevent all shell expansion
  // To include a single quote, we close the quote, add an escaped quote, and reopen
  // Example: user's file -> 'user'\''s file'
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Escapes a file path for safe use in shell commands
 * More permissive than escapeShellArg for common path characters
 *
 * @param path - File path to escape
 * @returns Safely escaped path
 */
export function escapeShellPath(path: string): string {
  // Validate path doesn't contain obvious injection attempts
  if (path.includes(';') || path.includes('|') || path.includes('&') || path.includes('`')) {
    throw new Error(`Potentially malicious path detected: ${path}`);
  }

  // Use single quotes for safety
  return escapeShellArg(path);
}

/**
 * Validates a URL for git clone operations
 * Only allows http/https/git protocols and github.com/gitlab.com domains
 *
 * @param url - Git remote URL to validate
 * @returns Validated URL
 * @throws Error if URL is invalid or potentially malicious
 */
export function validateGitUrl(url: string): string {
  // Allow http(s) and git protocols
  const allowedProtocols = /^(https?|git):\/\//;

  // Allow common git hosting services
  const allowedDomains = [
    'github.com',
    'gitlab.com',
    'bitbucket.org',
    'git.sr.ht',
    'codeberg.org',
  ];

  // Check protocol
  if (!allowedProtocols.test(url)) {
    throw new Error(`Invalid git URL protocol. Must be http, https, or git: ${url}`);
  }

  // Extract domain
  const domainMatch = url.match(/^https?:\/\/([^/]+)/);
  if (!domainMatch) {
    throw new Error(`Could not parse domain from URL: ${url}`);
  }

  const domain = domainMatch[1].replace(/^www\./, '');

  // Check if domain is allowed
  const isAllowed = allowedDomains.some(allowed =>
    domain === allowed || domain.endsWith(`.${allowed}`)
  );

  if (!isAllowed) {
    throw new Error(
      `Git URL domain not in allowlist. Allowed: ${allowedDomains.join(', ')}\n` +
      `Got: ${domain}\n` +
      `To clone from this domain, update the allowlist in src/utils/shell.ts`
    );
  }

  // Check for command injection characters
  if (url.includes(';') || url.includes('|') || url.includes('&') || url.includes('`')) {
    throw new Error(`Potentially malicious characters in git URL: ${url}`);
  }

  return url;
}
