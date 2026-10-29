import { Foo, unused } from './foo';
import * as foo from './foo';
// tsdoc-defaults: import { Platform } from './platform'
// tsdoc-defaults: import { Platform } from './platform';

export interface ImportOptions {
  /** @default `Foo.BAR` */
  foo?: Foo;
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
  /** @default `(x: foo.Foo) => x` */
  identity?: (x: foo.Foo) => foo.Foo;
}
