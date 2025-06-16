/**
 * @file src/modules/_types.ts
 * Shared type utilities that don't belong in the stricter JSON-schema module.
 * Currently only contains `ModuleSource`, but additional cross-cutting types
 * can be added here without bloating the manifest schema file.
 */

export interface ModuleSource<Manifest = unknown> {
  /** Where the manifest was discovered – absolute path (prod) or Vite glob key (dev). */
  locator: string;
  /** Parsed manifest object. */
  manifest: Manifest;
} 