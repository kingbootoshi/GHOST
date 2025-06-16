import { glob } from 'fast-glob';
import path from 'path';
import { pathToFileURL } from 'url';
import { 
  ModuleManifest, 
  LoadedModule, 
  ModuleContext, 
  ModuleMeta, 
  ToolSpec,
  createAjvInstance,
  moduleManifestSchema
} from '../modules/_schema';
import logger from './utils/logger';
import { getDb } from './db';

const log = logger.scope('loader');

// ---------------------------------------------------------------------------
// Helper interfaces – shared with other parts of the system if needed
// ---------------------------------------------------------------------------

/**
 * Source information used when registering a module.  `locator` uniquely
 * identifies the manifest's origin – in dev builds it's the import.glob key,
 * in production it's the absolute file path on disk.
 */
interface ModuleSource {
  locator: string;
  manifest: ModuleManifest;
}

export class ModuleLoader {
  private registry = new Map<string, LoadedModule>();
  private ajv = createAjvInstance();
  private validateManifest = this.ajv.compile(moduleManifestSchema);

  /**
   * Load all built-in modules from src/modules/*
   */
  async loadBuiltin(): Promise<void> {
    if (import.meta.env.MODE === 'development') {
      log.info('DEV mode – loading manifests via Vite glob');

      const sources = import.meta.glob('../modules/**/manifest.{ts,js}', {
        eager: true,
      });

      for (const [locator, mod] of Object.entries(sources)) {
        try {
          const manifestObj = (mod as any).default ?? (mod as any).manifest;
          await this.registerManifest({ locator, manifest: manifestObj });
        } catch (error) {
          log.error('Failed to register manifest %s: %o', locator, error);
        }
      }

      log.info('Loaded %d built-in modules (DEV)', this.registry.size);
      return;
    }

    // ────────────────────────────────────────────────────────────────
    // Packaged build – manifests reside under resources/modules/**
    // ────────────────────────────────────────────────────────────────
    log.info('PROD mode – loading manifests from resources directory');

    const modulesDir = path.join(process.resourcesPath, 'modules');
    const files = await glob('**/manifest.js', {
      cwd: modulesDir,
      absolute: true,
      onlyFiles: true,
    });

    for (const file of files) {
      try {
        await this.loadModuleFromFile(file);
      } catch (error) {
        log.error('Failed to load file %s: %o', file, error);
      }
    }

    log.info('Loaded %d built-in modules (PROD)', this.registry.size);
  }

  /**
   * Load external modules from a directory
   */
  async loadExternal(dir: string): Promise<void> {
    log.info('Loading external modules from %s', dir);
    
    const moduleDirs = await glob('**/manifest.{ts,js}', {
      cwd: dir,
      absolute: true,
      onlyFiles: true
    });

    for (const manifestPath of moduleDirs) {
      try {
        await this.loadModuleFromFile(manifestPath);
      } catch (error) {
        log.error('Failed to load external module from %s: %o', manifestPath, error);
      }
    }
  }

  /**
   * Load and validate a module manifest
   */
  private async loadManifest(manifestPath: string): Promise<ModuleManifest> {
    const manifestUrl = pathToFileURL(manifestPath).href;
    const manifestModule = await import(manifestUrl);
    const manifest = manifestModule.default || manifestModule.manifest;

    if (!this.validateManifest(manifest)) {
      throw new Error(`Invalid manifest: ${JSON.stringify(this.ajv.errors)}`);
    }

    // TODO: Add hash/signature check here

    return manifest as ModuleManifest;
  }

  /**
   * List all loaded modules
   */
  list(): ModuleMeta[] {
    return Array.from(this.registry.values()).map(module => ({
      id: module.manifest.id,
      title: module.manifest.title,
      version: module.manifest.version,
      icon: module.manifest.icon,
      hasSettings: !!module.manifest.settingsSchema,
      settingsSchema: module.manifest.settingsSchema
    }));
  }

  /**
   * Invoke a module function
   */
  async invoke(moduleId: string, functionName: string, args: any[]): Promise<unknown> {
    const module = this.registry.get(moduleId);
    if (!module) {
      throw new Error(`Module not found: ${moduleId}`);
    }

    const fn = module.functions.get(functionName);
    if (!fn) {
      throw new Error(`Function not found: ${moduleId}.${functionName}`);
    }

    return await fn(...args);
  }

  /**
   * Get aggregated tools from all modules (for future Ghost-AI)
   */
  aggregateTools(): ToolSpec[] {
    const tools: ToolSpec[] = [];

    for (const [moduleId, module] of this.registry) {
      for (const [name, fn] of module.functions) {
        tools.push({
          moduleId,
          name,
          description: (fn as any).description,
          parameters: (fn as any).parameters
        });
      }
    }

    return tools;
  }

  /**
   * Get module settings
   */
  private async getModuleSettings<T = any>(moduleId: string): Promise<T> {
    const db = getDb();
    if (!db) {
      throw new Error('Database not unlocked');
    }
    const result = await db.prepare(
      'SELECT json FROM module_settings WHERE module_id = ?'
    ).get(moduleId) as { json: string } | undefined;

    return result ? JSON.parse(result.json) : {};
  }

  /**
   * Patch module settings
   */
  private async patchModuleSettings<T = any>(moduleId: string, diff: Partial<T>): Promise<void> {
    const module = this.registry.get(moduleId);
    if (!module || !module.manifest.settingsSchema) {
      throw new Error(`Module ${moduleId} does not have settings schema`);
    }

    // Get current settings
    const current = await this.getModuleSettings<T>(moduleId);
    const updated = { ...current, ...diff };

    // Validate updated settings
    const validate = this.ajv.compile(module.manifest.settingsSchema);
    if (!validate(updated)) {
      throw new Error(`Invalid settings: ${JSON.stringify(this.ajv.errors)}`);
    }

    // Save to database
    const db = getDb();
    if (!db) {
      throw new Error('Database not unlocked');
    }
    await db.prepare(
      'INSERT OR REPLACE INTO module_settings (module_id, json) VALUES (?, ?)'
    ).run(moduleId, JSON.stringify(updated));
  }

  /**
   * Get a specific module by ID
   */
  getModule(moduleId: string): LoadedModule | undefined {
    return this.registry.get(moduleId);
  }

  // ---------------------------------------------------------------------
  // Manifest registration (single source of truth)
  // ---------------------------------------------------------------------

  private async registerManifest(source: ModuleSource): Promise<void> {
    const { manifest, locator } = source;

    // Validate manifest against schema once per registration
    if (!this.validateManifest(manifest)) {
      log.error('[manifest] validation error for %s: %o', locator, this.ajv.errors);
      throw new Error('INVALID_MANIFEST');
    }

    // Duplicate ID guard
    if (this.registry.has(manifest.id)) {
      log.error('[%s] duplicate – skipping second registration from %s', manifest.id, locator);
      return;
    }

    // Resolve absolute baseDir to locate entry files
    let resolvedPath: string;
    if (path.isAbsolute(locator)) {
      resolvedPath = locator;
    } else {
      // In dev builds the locator emitted by `import.meta.glob` is relative to
      // the *source* file.  The compiled main bundle lives under `.vite/build`
      // so using `new URL(locator, import.meta.url)` would incorrectly resolve
      // into `.vite/`.  Instead, we anchor the relative path to the original
      // source directory (`src/main`) which is a stable location during dev.
      resolvedPath = path.resolve(process.cwd(), 'src/main', locator);
    }

    const baseDir = path.dirname(resolvedPath);

    try {
      await this.initialiseModule(manifest, baseDir);
    } catch (err) {
      log.error('Failed to initialise manifest from %s: %o', locator, err);
      throw err; // bubble for caller logging
    }
  }

  // ---------------------------------------------------------------------
  // Fallback for production – load manifest from JS file on disk
  // ---------------------------------------------------------------------

  private async loadModuleFromFile(manifestPath: string): Promise<void> {
    try {
      const manifest = await this.loadManifest(manifestPath);
      await this.registerManifest({ locator: manifestPath, manifest });
    } catch (err) {
      log.error('loadModuleFromFile error:', { file: manifestPath, err });
      throw err;
    }
  }

  // ---------------------------------------------------------------------
  // Helper extracted from old loadModule logic – now used by registerManifest
  // ---------------------------------------------------------------------

  private async initialiseModule(manifest: ModuleManifest, baseDir: string): Promise<void> {
    log.info('[%s] loading module v%d', manifest.id, manifest.version);

    const mainPath = path.resolve(baseDir, manifest.entry.main);
    const mainUrl = pathToFileURL(mainPath).href;

    // ---------------------------------------------------------------------
    // In development the entry file is very likely raw TypeScript (".ts").
    // Node's native ESM loader will refuse to import it, resulting in
    //   ERR_UNKNOWN_FILE_EXTENSION
    // If we are in dev *and* the file ends with .ts we fall back to
    // `require()`.  The ts-node hook (registered in bootstrap.ts) compiles the
    // file on the fly so the call succeeds.  Production builds – where Vite
    // has already transpiled everything to .js – continue to use dynamic
    // `import()` so we keep native ESM behaviour.
    // ---------------------------------------------------------------------
    let moduleInstance: any;
    if (process.env.NODE_ENV === 'development' && mainPath.endsWith('.ts')) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      moduleInstance = require(mainPath);
    } else {
      moduleInstance = await import(/* @vite-ignore */ mainUrl);
    }

    // Prepare execution context
    const context: ModuleContext = {
      moduleId: manifest.id,
      logger: logger.scope(`module:${manifest.id}`),
      db: manifest.capabilities?.db ? getDb() : undefined,
      getSettings: async () => this.getModuleSettings(manifest.id),
      patchSettings: async (diff) => this.patchModuleSettings(manifest.id, diff),
    };

    if (moduleInstance.init) {
      log.info('[%s] Initialising module...', manifest.id);
      await moduleInstance.init(context);
    }

    const functions = new Map<string, (...args: any[]) => any>();
    for (const [name, value] of Object.entries(moduleInstance)) {
      if (typeof value === 'function' && name !== 'init') {
        functions.set(name, value.bind(null, context));
      }
    }

    this.registry.set(manifest.id, {
      manifest,
      instance: moduleInstance,
      functions,
    });

    log.info('[%s] loaded with %d fns', manifest.id, functions.size);
  }
}

// Create singleton instance
export const moduleLoader = new ModuleLoader();