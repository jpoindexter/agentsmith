/**
 * Estimate token count for text.
 * Uses a simple heuristic: ~4 characters per token for English text.
 * This is a rough estimate - actual tokenization varies by model.
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
 * Format token count for display
 */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 10000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${Math.round(tokens / 1000)}K`;
}

/**
 * Get context window usage as percentage
 */
export function getContextUsage(tokens: number, contextWindow: number = 128000): number {
  return Math.round((tokens / contextWindow) * 100);
}
