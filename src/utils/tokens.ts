/**
 * Token Estimation Utilities
 *
 * Provides rough token count estimates for text content.
 * Useful for gauging context window usage without requiring
 * a tokenizer library.
 *
 * @module utils/tokens
 */

/**
 * Estimates token count for text
 *
 * Uses a hybrid heuristic:
 * - Character-based: ~4 chars per token
 * - Word-based: ~1.3 tokens per word
 * - Returns average of both methods
 *
 * Note: Actual tokenization varies by model
 *
 * @param text - Text to estimate
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  // Method 1: Character-based (simple)
  const charBasedEstimate = Math.ceil(text.length / 4);

  // Method 2: Word-based (more accurate for prose)
  const words = text.split(/\s+/).filter(Boolean).length;
  const wordBasedEstimate = Math.ceil(words * 1.3); // ~1.3 tokens per word

  // Use average of both methods
  return Math.ceil((charBasedEstimate + wordBasedEstimate) / 2);
}

/**
 * Formats token count for display
 *
 * @param tokens - Token count
 * @returns Formatted string (e.g., "500", "1.5K", "12K")
 */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 10000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${Math.round(tokens / 1000)}K`;
}

/**
 * Calculates context window usage as percentage
 *
 * @param tokens - Token count
 * @param contextWindow - Model context window size (default: 128K)
 * @returns Usage percentage (0-100)
 */
export function getContextUsage(tokens: number, contextWindow: number = 128000): number {
  return Math.round((tokens / contextWindow) * 100);
}
