export interface Opts {
  /** @default `{ a: 1 */
  span?: object;
  /**
   * @default
   * ```ts
   * { mention: 'cc @team' }
   * ```
   */
  mention?: object;
  /**
   * @default
   * ````ts
   * class {
   *   @observable x = 1;
   * }
   * ````
   */
  model?: object;
}
