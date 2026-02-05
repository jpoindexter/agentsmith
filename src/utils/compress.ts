/**
 * Compress code by extracting signatures only
 * Reduces token count by 40-50%
 */

export interface CompressedComponent {
  name: string;
  path: string;
  signature: string;
  props?: string[];
}

/**
 * Extract function/component signature without implementation
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
 * Extract TypeScript interface/type for props
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
 * Compress component content to signature only
 */
export function compressComponent(
  content: string,
  componentName: string
): { signature: string; propsType: string | null } {
  const signature = extractSignature(content, componentName);
  const propsType = extractPropsType(content);

  return { signature, propsType };
}
