import { Foo, unused } from './foo';
// tsdoc-defaults: import { Platform } from './platform'

export interface ImportOptions {
  /** @default `Foo.BAR` */
  foo?: Foo;
  /** Uses `unused` only in prose, so its import is not copied. */
  other?: typeof unused;
  /**
   * @default
   * ```ts
   * {
   *   attempts: 3,
   *   backoff: (n: number) => n * 2,
   * }
   * ```
   */
  retry?: { attempts: number; backoff: (n: number) => number };
  /** @default `Platform.OS === 'ios'` */
  bounces?: boolean;
}
