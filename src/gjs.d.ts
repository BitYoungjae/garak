// GJS global types not covered by @girs/gjs

declare const console: {
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
};

declare class TextDecoder {
  constructor(encoding?: string);
  decode(input: Uint8Array | ArrayBuffer): string;
}
