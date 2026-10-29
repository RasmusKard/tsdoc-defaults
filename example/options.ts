// Demo source for the GitHub Pages site: each property shows one way the TypeDoc plugin handles a tag.
/**
 * Options for an example HTTP client.
 *
 * The source of this page, with its `@default` tags:
 *
 * {@includeCode ./options.ts#source}
 *
 * The file `tsdoc-defaults` generates from those tags:
 *
 * {@includeCode ./options.defaults.ts}
 */
// #region source
// tsdoc-defaults: import os from 'node:os'
export interface ClientOptions {
  /**
   * Request timeout in milliseconds.
   * @default `10_000`
   */
  timeoutMs?: number;

  /**
   * Retries after a failed request.
   * @defaultValue 3
   */
  retries?: number;

  /**
   * Directory for cached responses.
   * @default `os.tmpdir()`
   */
  cacheDir?: string;

  /**
   * Base URL for relative request paths. Prose stays a "Default" block.
   * @default the origin of the current page
   */
  baseUrl?: string;
}
// #endregion source
