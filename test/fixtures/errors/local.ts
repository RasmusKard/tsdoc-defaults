const LOCAL = 5;
function helper() {
  return 1;
}
export type Mode = 'a' | 'b';

export interface Opts {
  /** @default `LOCAL` */
  a?: number;
  /** @default `helper()` */
  b?: number;
  /** @default `'a' as Mode` */
  mode?: Mode;
}
