export interface Component {
  name: string;
  path: string;
  importPath: string;
  exports: string[];
}

export interface Tokens {
  colors: Record<string, string>;
  spacing: Record<string, string>;
  radius: Record<string, string>;
  fonts: string[];
}

export interface Framework {
  name: string;
  version?: string;
  router?: string;
  language: string;
  styling?: string;
}

export interface ScanResult {
  components: Component[];
  tokens: Tokens;
  framework: Framework;
}
