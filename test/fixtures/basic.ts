export interface BridgeOptions {
  /**
   * How long to wait for the native side, in milliseconds.
   * @default `10_000`
   */
  timeoutMs?: number;
  /** @defaultValue `'cover'` */
  fit?: 'cover' | 'contain';
  /** @default `{ customUserAgent: null, inspectable: __DEV__ }` */
  webView?: { customUserAgent?: string | null; inspectable?: boolean };
  /** @default `__DEV__ ? 'debug' : 'warn'` */
  logLevel?: 'debug' | 'warn';
  /** @default `true` */
  'data-enabled'?: boolean;
  /** Not tagged, so not in DEFAULTS. */
  name?: string;
}

export interface IOSOptions extends BridgeOptions {
  /** @default `false` */
  bounces?: boolean;
}

export type Theme = {
  /** @default `'light'` */
  mode?: 'light' | 'dark';
  /** @default 14 */
  fontSize?: number;
  /** @default the platform accent color */
  accent?: string;
};
