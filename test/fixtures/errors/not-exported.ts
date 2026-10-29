interface Hidden {
  /** @default `1` */
  x?: number;
}

interface Renamed {
  /** @default `2` */
  y?: number;
}

export default interface Default {
  /** @default `3` */
  z?: number;
}

export { Renamed as Other };
