const LOCAL = 5;
function helper() {
  return 1;
}

export interface Opts {
  /** @default `LOCAL` */
  a?: number;
  /** @default `helper()` */
  b?: number;
}
