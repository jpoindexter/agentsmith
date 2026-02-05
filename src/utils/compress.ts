/**
 * Code Compression Utility
 *
 * Reduces token count by extracting only function signatures
 * and type definitions, omitting implementation details.
 * Achieves 40-50% reduction in token count.
 *
 * @module utils/compress
 */

/** Compressed component information */
export interface CompressedComponent {
  /** Component name */
  name: string;
  /** File path */
  path: string;
  /** Function signature (without body) */
  signature: string;
  /** Prop names if available */
  props?: string[];
}

/**
 * Extracts function/component signature without implementation body
 *
 * @param content - Full file content
 * @param componentName - Name of the component to find
 * @returns Signature string or generic fallback
 *
 * @example
 * extractSignature(code, "Button")
 * // "export function Button(props: ButtonProps): JSX.Element"
 */
export function extractSignature(content: string, componentName: string): string {
  // Try to find the component definition
  const patterns = [
    // export function ComponentName(props: Props) { ... }
    new RegExp(`export\\s+function\\s+${componentName}\\s*\\([^)]*\\)\\s*(?::\\s*[^{]+)?`, "m"),
    // export const ComponentName = (props: Props) => { ... }
    new RegExp(`export\\s+const\\s+${componentName}\\s*=\\s*\\([^)]*\\)\\s*(?::\\s*[^=]+)?\\s*=>`, "m"),
    // export const ComponentName: React.FC<Props> = (props) => { ... }
    new RegExp(`export\\s+const\\s+${componentName}\\s*:\\s*[^=]+=\\s*\\([^)]*\\)\\s*=>`, "m"),
    // const ComponentName = forwardRef<...>((props, ref) => { ... })
    new RegExp(`const\\s+${componentName}\\s*=\\s*forwardRef[^(]*\\(\\([^)]*\\)\\s*=>`, "m"),
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }

  return `export function ${componentName}(...)`;
}

/**
 * Extracts TypeScript Props interface/type definition
 *
 * @param content - Full file content
 * @returns Compressed props type definition or null
 */
export function extractPropsType(content: string): string | null {
  // Match interface XxxProps { ... }
  const interfaceMatch = content.match(/interface\s+(\w*Props)\s*(?:extends[^{]+)?\{([^}]+)\}/s);
  if (interfaceMatch) {
    const name = interfaceMatch[1];
    const body = interfaceMatch[2];
    // Simplify: just get property names with types on single line
    const props = body
      .split("\n")
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("//") && !line.startsWith("/*"))
      .map(line => {
        const match = line.match(/^(\w+)\??\s*:\s*([^;]+)/);
        if (match) return `${match[1]}: ${match[2].trim().slice(0, 30)}`;
        return null;
      })
      .filter(Boolean)
      .slice(0, 10);

    if (props.length > 0) {
      return `interface ${name} { ${props.join("; ")} }`;
    }
  }

  // Match type XxxProps = { ... }
  const typeMatch = content.match(/type\s+(\w*Props)\s*=\s*\{([^}]+)\}/s);
  if (typeMatch) {
    const name = typeMatch[1];
    const body = typeMatch[2];
    const props = body
      .split("\n")
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("//"))
      .map(line => {
        const match = line.match(/^(\w+)\??\s*:\s*([^;,]+)/);
        if (match) return `${match[1]}: ${match[2].trim().slice(0, 30)}`;
        return null;
      })
      .filter(Boolean)
      .slice(0, 10);

    if (props.length > 0) {
      return `type ${name} = { ${props.join("; ")} }`;
    }
  }

  return null;
}

/**
 * Compresses component content to signature and props only
 *
 * @param content - Full file content
 * @param componentName - Name of the component
 * @returns Compressed signature and props type
 */
export function compressComponent(
  content: string,
  componentName: string
): { signature: string; propsType: string | null } {
  const signature = extractSignature(content, componentName);
  const propsType = extractPropsType(content);

  return { signature, propsType };
}
