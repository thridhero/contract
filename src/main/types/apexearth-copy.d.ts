declare module '@apexearth/copy' {
  export interface ApexearthCopyOptions {
    from: string;
    to: string;
    recursive?: boolean;
    overwrite?: boolean;
    overwriteMismatches?: boolean;
    verbose?: boolean;
    json?: boolean | 'pretty';
    ignoreErrors?: boolean;
    parallelJobs?: number;
    state?: string;
    stateFrequency?: number;
    copyFile?: (from: string, to: string, cb: (err?: NodeJS.ErrnoException | null) => void) => void;
    readdir?: (path: string, cb: (err: NodeJS.ErrnoException | null, files?: string[]) => void) => void;
    stat?: (path: string, cb: (err: NodeJS.ErrnoException | null, stats?: any) => void) => void;
  }

  function copy(options: ApexearthCopyOptions): Promise<void>;
  export = copy;
}

