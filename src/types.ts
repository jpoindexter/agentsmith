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

export interface Hook {
  name: string;
  path: string;
  importPath: string;
  isClientOnly: boolean;
}

export interface Utilities {
  hasCn: boolean;
  cnPath?: string;
  hasMode: boolean;
  modePath?: string;
  hasShadcn: boolean;
  radixPackages: string[];
  hasCva: boolean;
  customUtils: string[];
}

export interface Commands {
  dev?: string;
  build?: string;
  test?: string;
  lint?: string;
  format?: string;
  typecheck?: string;
  db?: Record<string, string>;
  custom: Record<string, string>;
}

export interface ExistingContext {
  hasClaudeMd: boolean;
  claudeMdPath?: string;
  claudeMdContent?: string;
  hasAgentsMd: boolean;
  agentsMdPath?: string;
  hasAiFolder: boolean;
  aiFiles: string[];
  hasCursorRules: boolean;
}

export interface ScanResult {
  components: Component[];
  tokens: Tokens;
  framework: Framework;
  hooks: Hook[];
  utilities: Utilities;
  commands: Commands;
  existingContext: ExistingContext;
}
