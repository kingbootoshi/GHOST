import logger from './utils/logger';
import Database from 'better-sqlite3-multiple-ciphers';
import { v4 as uuidv4 } from 'uuid';

/// <reference types="vite/client" />

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
  /** Unique identifier for the module – must be stable across app restarts */
  id: string;

  /** Optional SQL schema executed exactly once on startup (idempotent) */
  schema?: string;

  /** Metadata consumed by the renderer dashboard */
  meta: {
    /** Human-readable title shown in the sidebar */
    title: string;
    /** Optional emoji/SVG displayed next to the title */
    icon?: string;
  };

  /** Public functions exposed to IPC & other modules */
  functions: ToolDef[];

  /** Optional async initialisation hook */
  init?: (ctx: ModuleContext) => Promise<void>;
}

class ModuleRegistry {
  private modules: Map<string, AssistantModule> = new Map();
  private tools: Map<string, ToolDef> = new Map();
  private db: Database.Database | null = null;

  /**
   * Loads and initialises all assistant modules bundled by Vite.  The
   * implementation relies on `import.meta.glob` with the `eager` flag so that
   * modules are discovered at **compile-time** instead of via runtime `fs`
   * introspection.
   */
  async loadModules(db: Database.Database) {
    this.db = db;

    /*
     * TS throws because `import.meta` is only fully typed when `module` is set
     * to `esnext`.  The build, however, goes through Vite which supports the
     * transform regardless of the TS module target.  We therefore suppress the
     * type-checker on the following line while keeping runtime safety via the
     * explicit generic.
     */
    // @ts-ignore -- handled by Vite
    const modules = import.meta.glob<{ default: AssistantModule }>('/src/modules/**/index.{ts,js}', { eager: true });

    for (const modEntry of Object.values(modules)) {
      const mod = (modEntry as any).default as AssistantModule;
      await this.registerModule(mod);
    }

    logger.info(`Loaded ${this.modules.size} modules (compile-time registry)`);
  }

  /** Registers a single module instance */
  private async registerModule(module: AssistantModule) {
    if (!module.id) {
      module.id = uuidv4();
    }

    logger.info(`Initialising module ${module.id}`);

    // Apply DB schema if provided
    if (module.schema && this.db) {
      this.db.exec(module.schema);
      logger.info(`[${module.id}] schema applied`);
    }

    // Prepare execution context
    const context: ModuleContext = {
      db: this.db!,
      registerTool: (tool) => this.registerTool(module.id, tool),
      log: logger.scope(module.id),
    };

    // Run optional init hook
    if (module.init) {
      await module.init(context);
    }

    // Register public functions
    for (const func of module.functions) {
      this.registerTool(module.id, func);
    }

    this.modules.set(module.id, module);
    logger.info(`[${module.id}] ready – functions=${module.functions.length}`);
  }

  private registerTool(moduleId: string, tool: ToolDef) {
    const fullName = `${moduleId}.${tool.name}`;
    this.tools.set(fullName, tool);
    logger.info(`Registered tool: ${fullName}`);
  }

  /** Returns lightweight metadata for the renderer dashboard */
  listModules() {
    return Array.from(this.modules.values()).map((m) => ({
      id: m.id,
      title: m.meta?.title ?? m.id,
      icon: m.meta?.icon,
    }));
  }

  /**
   * Invokes a module function by name.  Throws an Error if the module or
   * function does not exist.  Errors from the function bubble up unmodified so
   * the caller can handle them.
   */
  async invoke(moduleId: string, fn: string, args: any): Promise<unknown> {
    const toolName = `${moduleId}.${fn}`;
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error('FUNCTION_NOT_FOUND');
    }
    return tool.handler(args);
  }

  getTool(name: string): ToolDef | undefined {
    return this.tools.get(name);
  }

  getAllTools(): ToolDef[] {
    return Array.from(this.tools.values());
  }
}

export const moduleRegistry = new ModuleRegistry();