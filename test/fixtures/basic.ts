export interface BridgeOptions {
  /** @default `10_000 // ten seconds` */
  timeoutMs?: number;
  /** @defaultValue `'cover'` */
  fit?: 'cover' | 'contain';
  /** @default `{ customUserAgent: null, inspectable: __DEV__ }` */
  webView?: { customUserAgent?: string | null; inspectable?: boolean };
  /** @default `true` */
  'data-enabled'?: boolean;
  /** @default `2` */
  0?: number;
  /**
   * @defaultValue
   * ```ts
   * // two lines
   * `line1
   *   line2`
   * ```
   */
  banner?: string;
  /** @default `` `${'a'}b` `` */
  label?: string;
  /** @default 3 */
  retries?: number;
  /** @default undefined */
  agent?: string;
  /** @default the platform accent color */
  accent?: string;
  name?: string;
}

export interface IOSOptions extends BridgeOptions {
  /** @default `false` */
  bounces?: boolean;
}

export type Theme = {
  /** @default { dark: false } */
  palette?: { dark: boolean };
  /** @default none */
  border?: string;
  /** @default `start` or `end` */
  align?: 'start' | 'end';
};

interface Listed {
  /** @default `1` */
  x?: number;
}
export type { Listed };
