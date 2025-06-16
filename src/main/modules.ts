import logger from './utils/logger';
import { moduleLoader } from './loader';
import { ModuleMeta } from '../modules/_schema';

/**
 * Legacy module registry that wraps the new ModuleLoader
 * This maintains backward compatibility while using the new loader internally
 */
class ModuleRegistry {
  /**
   * Loads and initialises all modules using the new loader
   */
  async loadModules(_db: any) {

    try {
      // Load built-in modules
      await moduleLoader.loadBuiltin();
      
      // TODO: Load external modules from user directory
      // const externalDir = path.join(app.getPath('userData'), 'modules');
      // if (fs.existsSync(externalDir)) {
      //   await moduleLoader.loadExternal(externalDir);
      // }
      
      const modules = moduleLoader.list();
      logger.info(`Loaded ${modules.length} modules via new loader`);
    } catch (error) {
      logger.error('Failed to load modules:', error);
      throw error;
    }
  }

  /** Returns lightweight metadata for the renderer dashboard */
  listModules(): ModuleMeta[] {
    return moduleLoader.list();
  }

  /**
   * Invokes a module function by name
   */
  async invoke(moduleId: string, fn: string, args: any): Promise<unknown> {
    try {
      return await moduleLoader.invoke(moduleId, fn, [args]);
    } catch (error) {
      logger.error(`Failed to invoke ${moduleId}.${fn}:`, error);
      throw error;
    }
  }

  getTool(name: string) {
    const [moduleId, functionName] = name.split('.');
    const module = moduleLoader.getModule(moduleId);
    if (!module) return undefined;
    return module.functions.get(functionName);
  }

  getAllTools() {
    return moduleLoader.aggregateTools().map(tool => `${tool.moduleId}.${tool.name}`);
  }
}

export const moduleRegistry = new ModuleRegistry();