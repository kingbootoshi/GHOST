import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { JSONSchemaType } from 'ajv';

export type JSONSchema = JSONSchemaType<any>;

export interface ModuleManifest {
  id: string;                 // kebab-case unique id
  version: number;            // bump on breaking change
  title: string;
  icon?: string | string;     // string or emoji
  capabilities?: {
    db?: boolean;
    net?: string[];          // allow-listed hostnames
    fs?: boolean;            // discouraged – triggers user prompt
  };
  entry: {
    main: string;            // relative TS/JS file
    ui?: string;
    settings?: string;
    agent?: string;
  };
  settingsSchema?: JSONSchema; // Ajv compatible
}

export interface LoadedModule {
  manifest: ModuleManifest;
  instance: any;
  functions: Map<string, (...args: any[]) => any>;
}

export interface ModuleContext {
  moduleId: string;
  logger: any;
  db?: any;
  getSettings: <T = any>() => Promise<T>;
  patchSettings: <T = any>(diff: Partial<T>) => Promise<void>;
}

export interface ModuleMeta {
  id: string;
  title: string;
  version: number;
  icon?: string;
  hasSettings: boolean;
  settingsSchema?: JSONSchema;
}

export interface ToolSpec {
  moduleId: string;
  name: string;
  description?: string;
  parameters?: JSONSchema;
}

// Factory function to create Ajv instance with formats
export function createAjvInstance(): Ajv {
  const ajv = new Ajv({ allErrors: true, verbose: true });
  addFormats(ajv);
  return ajv;
}

// Module manifest schema for validation
export const moduleManifestSchema: JSONSchemaType<ModuleManifest> = {
  type: 'object',
  properties: {
    id: { type: 'string', pattern: '^[a-z][a-z0-9-]*$' },
    version: { type: 'number', minimum: 1 },
    title: { type: 'string', minLength: 1 },
    icon: { type: 'string', nullable: true },
    capabilities: {
      type: 'object',
      properties: {
        db: { type: 'boolean', nullable: true },
        net: { 
          type: 'array', 
          items: { type: 'string' },
          nullable: true 
        },
        fs: { type: 'boolean', nullable: true }
      },
      nullable: true,
      additionalProperties: false
    },
    entry: {
      type: 'object',
      properties: {
        main: { type: 'string' },
        ui: { type: 'string', nullable: true },
        settings: { type: 'string', nullable: true },
        agent: { type: 'string', nullable: true }
      },
      required: ['main'],
      additionalProperties: false
    },
    settingsSchema: { type: 'object', nullable: true }
  },
  required: ['id', 'version', 'title', 'entry'],
  additionalProperties: false
};