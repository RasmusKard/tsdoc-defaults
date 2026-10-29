export interface BridgeOptions {
  /**
   * How long to wait for the native side, in milliseconds.
   * @default `10_000`
   */
  timeoutMs?: number;
  /** @defaultValue `'cover'` */
  fit?: 'cover' | 'contain';
  /** @default `__DEV__ ? 'debug' : 'warn'` */
  logLevel?: 'debug' | 'warn';
  /** @default 14 */
  fontSize?: number;
  /**
   * @defaultValue
   * ```ts
   * { retries: 3, backoff: (n: number) => n * 2 }
   * ```
   */
  retry?: { retries: number; backoff: (n: number) => number };
  /** @default none */
  accent?: string;
  /** @defaultValue the viewport width */
  width?: number;
  /** Not tagged. */
  name?: string;
}
