export interface Opts {
  /** @default `{ a: 1` */
  span?: object;
  /**
   * @defaultValue
   * ```
   * const x = 1;
   * x
   * ```
   */
  fence?: number;
  /** @default `1, 2` */
  comma?: number;
}
