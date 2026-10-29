export interface Opts {
  nested?: {
    /** @default `1` */
    inner?: number;
  };
}

export type Intersection = { a?: number } & {
  /** @default `1` */
  b?: number;
};

export class Klass {
  /**
   * @default
   * ```ts
   * 1
   * ```
   */
  e = 1;
}

/** @default 1 */
export const bare = 1;

/** @default one, unless overridden */
export const h = 1;
