import * as path from 'path';
import * as fs from 'fs';
import logger from './utils/logger';
import Database from 'better-sqlite3-multiple-ciphers';
import { v4 as uuidv4 } from 'uuid';

export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: JSONSchema;
  handler: (args: any) => Promise<unknown>;
}

export interface ModuleContext {
  db: Database.Database;
  registerTool: (tool: ToolDef) => void;
  log: ReturnType<typeof logger.scope>;
}

export interface AssistantModule {
  id: string;
  schema: string;
  functions: ToolDef[];
  init: (ctx: ModuleContext) => Promise<void>;
}

class ModuleRegistry {
  private modules: Map<string, AssistantModule> = new Map();
  private tools: Map<string, ToolDef> = new Map();
  private db: Database.Database | null = null;

  async loadModules(db: Database.Database) {
    this.db = db;
    // In dev, modules might be in src, in production they'll be in the built location
    const isDev = process.env.NODE_ENV === 'development';
    const modulesDir = isDev 
      ? path.join(__dirname, '..', '..', 'src', 'modules')
      : path.join(__dirname, '..', 'modules');
    
    logger.info('Loading modules from:', modulesDir);
    
    try {
      const moduleFolders = fs.readdirSync(modulesDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory());
      
      for (const folder of moduleFolders) {
        // --- NEW: attempt to resolve compiled JS path first in dev ---
        const compiledPath = this.resolveCompiledPath(folder.name);
        if (compiledPath) {
          await this.loadModule(compiledPath);
          continue; // skip further resolution if compiled module found
        }

        // Check for both .js and .ts files depending on environment
        const jsPath = path.join(modulesDir, folder.name, 'index.js');
        const tsPath = path.join(modulesDir, folder.name, 'index.ts');
        
        if (fs.existsSync(jsPath)) {
          await this.loadModule(jsPath);
        } else if (fs.existsSync(tsPath)) {
          await this.loadModule(tsPath);
        }
      }
      
      logger.info(`Loaded ${this.modules.size} modules`);
    } catch (error) {
      logger.error('Error loading modules:', error);
    }
  }

  /**
   * Attempts to resolve the location of a dev-time compiled plugin.
   * When running the main process via Vite (development), compiled plugins
   * are emitted to `.vite/modules/<plugin>/index.js`.  This helper checks
   * that location first so we avoid importing raw TypeScript which Node
   * cannot execute natively.
   *
   * @param {string} pluginName – Directory name of the plugin (e.g., "echo")
   * @returns {string | null} Absolute path to the compiled JS or `null` if it
   * does not exist.
   */
  private resolveCompiledPath(pluginName: string): string | null {
    // `__dirname` points to `.vite/build` in development so we backtrack to
    // project root and then into `.vite/modules`.
    const candidate = path.join(__dirname, '..', '..', '.vite', 'modules', pluginName, 'index.js');
    return fs.existsSync(candidate) ? candidate : null;
  }

  private async loadModule(modulePath: string) {
    try {
      // Dynamic import for TypeScript modules
      const moduleExports = await import(modulePath);
      const module = moduleExports.default as AssistantModule;
      
      if (!module.id) {
        module.id = uuidv4();
      }
      
      logger.info(`Loading module ${module.id} from ${modulePath}`);
      
      // Apply module schema
      if (module.schema && this.db) {
        this.db.exec(module.schema);
        logger.info(`Applied schema for module ${module.id}`);
      }
      
      // Initialize module
      const context: ModuleContext = {
        db: this.db!,
        registerTool: (tool) => this.registerTool(module.id, tool),
        log: logger.scope(module.id)
      };
      
      await module.init(context);
      
      // Register module functions
      for (const func of module.functions) {
        this.registerTool(module.id, func);
      }
      
      this.modules.set(module.id, module);
      logger.info(`Module ${module.id} initialized with ${module.functions.length} functions`);
    } catch (error) {
      logger.error(`Failed to load module from ${modulePath}:`, error);
    }
  }

  private registerTool(moduleId: string, tool: ToolDef) {
    const fullName = `${moduleId}.${tool.name}`;
    this.tools.set(fullName, tool);
    logger.info(`Registered tool: ${fullName}`);
  }

  getTool(name: string): ToolDef | undefined {
    return this.tools.get(name);
  }

  getAllTools(): ToolDef[] {
    return Array.from(this.tools.values());
  }
}

export const moduleRegistry = new ModuleRegistry();