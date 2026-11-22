/** Авторская граница; наличие API и полнота визуального соответствия независимы. */
export interface SourceBinding {
  readonly props?: Readonly<Record<string, string | number | boolean>>;
  /** Что именно сопоставлено. Не свидетельство визуальной проверки. */
  readonly scope: string;
}

export interface CatalogSource {
  readonly page: string;
  readonly name: string;
  readonly type: 'component-set' | 'component';
  readonly uses: readonly {
    readonly family: string;
    readonly role: 'root' | 'variant' | 'part' | 'material';
    readonly web?: SourceBinding;
    readonly native?: SourceBinding;
  }[];
}

export interface CatalogFamily {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly group: string;
  readonly kind: 'control' | 'composition' | 'material' | 'extension' | 'internal';
  readonly web?: { readonly subpath: string; readonly reactExport: string };
  readonly webModule?: { readonly path: string; readonly export: string };
  readonly native?: {
    readonly symbol: string;
    /** API supplied by a public dependency rather than the local Kotlin tree. */
    readonly dependency?: { readonly module: string; readonly release: string };
  };
  readonly profile?: string;
  readonly guide?: { readonly href: string; readonly label: string };
}

export interface CatalogRegistry {
  readonly schemaVersion: 1;
  readonly source: {
    readonly publicUrl: string;
    readonly edition: string;
    readonly observed: string;
  };
  readonly groups: readonly { readonly id: string; readonly title: string }[];
  readonly families: readonly CatalogFamily[];
  readonly sources: readonly CatalogSource[];
  /** Asset collections outside the component-family catalog, classified by exact page. */
  readonly sourceExclusions: readonly { readonly page: string; readonly reason: string }[];
}

export interface NativeApi {
  readonly revision: string;
  readonly sourceDigest: string;
  readonly symbols: readonly { readonly name: string; readonly file: string }[];
}

export interface ProfileSourceRef {
  readonly key: string;
  readonly variant?: Readonly<Record<string, string>>;
  readonly path?: readonly string[];
}

export interface CatalogEntry extends CatalogFamily {
  readonly documentation: string | null;
  readonly capabilities: {
    readonly web: {
      readonly tag: string | null;
      readonly reactExport: string | null;
      readonly module?: string;
    } | null;
    readonly native:
      | { readonly symbol: string; readonly file: string; readonly revision: string }
      | {
          readonly symbol: string;
          readonly dependency: {
            readonly module: string;
            readonly version: string;
            readonly githubRepository: string;
            readonly mavenRepositoryCommit: string;
          };
        }
      | null;
  };
  readonly sources: readonly (Omit<CatalogSource, 'uses'> & CatalogSource['uses'][number])[];
}

export interface CatalogProjection {
  readonly source: CatalogRegistry['source'];
  readonly groups: CatalogRegistry['groups'];
  readonly families: readonly CatalogEntry[];
}
