/**
 * Output Splitting Utility
 *
 * Splits large AGENTS.md files into multiple smaller chunks
 * to fit within context window limits. Splits at section
 * boundaries (## headers) to maintain document coherence.
 *
 * @module utils/split
 */

/** Result of splitting content into chunks */
export interface SplitResult {
  /** Array of content chunks */
  chunks: string[];
  /** Total size in bytes */
  totalSize: number;
}

/**
 * Parses a human-readable size string to bytes
 *
 * @param size - Size string (e.g., "100kb", "1mb", "500")
 * @returns Size in bytes
 * @throws Error if format is invalid
 *
 * @example
 * parseSize("100kb") // 102400
 * parseSize("1mb")   // 1048576
 */
export function parseSize(size: string): number {
  const match = size.match(/^(\d+(?:\.\d+)?)\s*(kb|mb|k|m)?$/i);
  if (!match) {
    throw new Error(`Invalid size format: "${size}". Use format like "100kb" or "1mb"`);
  }

  const value = parseFloat(match[1]);
  const unit = (match[2] || "").toLowerCase();

  switch (unit) {
    case "kb":
    case "k":
      return Math.floor(value * 1024);
    case "mb":
    case "m":
      return Math.floor(value * 1024 * 1024);
    default:
      return Math.floor(value); // bytes
  }
}

/**
 * Splits content into chunks at section boundaries
 *
 * @param content - Full content to split
 * @param maxBytes - Maximum bytes per chunk
 * @returns Split result with chunks array
 *
 * @example
 * const result = splitContent(markdown, 100 * 1024); // 100KB chunks
 * console.log(`Split into ${result.chunks.length} parts`);
 */
export function splitContent(content: string, maxBytes: number): SplitResult {
  const chunks: string[] = [];
  const totalSize = Buffer.byteLength(content, "utf-8");

  // If content fits in one chunk, return as-is
  if (totalSize <= maxBytes) {
    return { chunks: [content], totalSize };
  }

  // Split by ## headers
  const sections = content.split(/(?=^## )/m);

  // Find header section (everything before first ##)
  const headerMatch = content.match(/^([\s\S]*?)(?=^## )/m);
  const header = headerMatch ? headerMatch[1] : "";
  const headerSize = Buffer.byteLength(header, "utf-8");

  // Build chunks
  let currentChunk = header;
  let currentSize = headerSize;
  let chunkIndex = 1;

  for (const section of sections) {
    // Skip empty sections or the header (already added)
    if (!section.trim() || !section.startsWith("## ")) continue;

    const sectionSize = Buffer.byteLength(section, "utf-8");

    // If adding this section exceeds limit, start a new chunk
    if (currentSize + sectionSize > maxBytes && currentChunk.trim()) {
      // Add continuation note to current chunk
      chunks.push(currentChunk.trim() + `\n\n---\n*Continued in AGENTS-${String(chunkIndex + 1).padStart(3, "0")}.md*\n`);
      chunkIndex++;

      // Start new chunk with header reference
      currentChunk = `# AGENTS.md (Part ${chunkIndex})\n\n> Continuation from Part ${chunkIndex - 1}\n\n`;
      currentSize = Buffer.byteLength(currentChunk, "utf-8");
    }

    // Add section to current chunk
    currentChunk += section;
    currentSize += sectionSize;
  }

  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return { chunks, totalSize };
}

/**
 * Generates numbered filenames for split output
 *
 * @param baseName - Base filename (e.g., "AGENTS.md")
 * @param count - Number of chunks
 * @returns Array of filenames (e.g., ["AGENTS-001.md", "AGENTS-002.md"])
 */
export function getSplitFilenames(baseName: string, count: number): string[] {
  const ext = baseName.match(/\.[^.]+$/)?.[0] || ".md";
  const base = baseName.replace(/\.[^.]+$/, "");

  return Array.from({ length: count }, (_, i) =>
    `${base}-${String(i + 1).padStart(3, "0")}${ext}`
  );
}
