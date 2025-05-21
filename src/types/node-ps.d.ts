declare module 'node-ps' {
  interface ProcessInfo {
    pid: number;
    ppid?: number;
    command?: string;
    arguments?: string;
    rss?: number;
    vsz?: number;
  }

  export function ps(): Promise<ProcessInfo[]>;
}
