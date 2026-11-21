export declare const TREES: ReadonlyArray<{ source: string; dest: string; mode: 'rewrite' | 'verbatim' }>
export declare function buildSkills(): {
  files: Map<string, string | { copyFrom: string }>
  failures: string[]
}
