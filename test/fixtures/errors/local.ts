const LOCAL = 5;
function helper() {
  return 1;
}
export type Mode = 'a' | 'b';
export namespace Limits {
  export const timeoutMs = 5_000;
}
const { a: renamed, nested: { deep }, ...rest } = { a: 1, nested: { deep: 2 } };
const [first, , [second], ...others] = [1, 2, [3]];
declare global {
  var shared: number;
}

export interface Opts {
  /** @default `LOCAL` */
  a?: number;
  /** @default `helper()` */
  b?: number;
  /** @default `'a' as Mode` */
  mode?: Mode;
  /** @default `Limits.timeoutMs` */
  c?: number;
  /** @default `[renamed, deep, rest, first, second, others]` */
  d?: unknown[];
  /** @default `global.shared` */
  e?: number;
}
