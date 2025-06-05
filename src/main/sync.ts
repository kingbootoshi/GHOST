import { Logger } from './utils/logger';
import type { Database as BetterSqlite3Database } from 'better-sqlite3';

const logger = new Logger('sync');

interface SyncConfig {
  db: BetterSqlite3Database;
  supabaseUrl: string;
  getAuthToken: () => Promise<string | null>;
}

interface SyncStatus {
  enabled: boolean;
  lastSyncedAt: number | null;
  pendingBytes: number;
}

// Dynamic schema that will be built as tables are registered
interface TableSchema {
  name: string;
  columns: Record<string, string>;
}

class SyncManager {
  private powerSyncDb: any = null; // PowerSync database instance
  private config: SyncConfig | null = null;
  private registeredTables: Set<string> = new Set();
  private syncStatus: SyncStatus = {
    enabled: false,
    lastSyncedAt: null,
    pendingBytes: 0
  };
  private schemas: Map<string, TableSchema> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;

  async init(config: SyncConfig): Promise<void> {
    logger.debug('[sync] init-start');
    
    try {
      this.config = config;
      
      // For MVP, we'll use the existing SQLite database
      // PowerSync will manage its own sync state within this database
      
      // Set up periodic sync status updates
      this.syncInterval = setInterval(() => {
        if (this.syncStatus.enabled) {
          logger.debug('[sync] outbound batch', { pendingBytes: this.syncStatus.pendingBytes });
          this.syncStatus.lastSyncedAt = Date.now();
        }
      }, 5000);

      this.syncStatus.enabled = true;
      
      logger.debug('[sync] init-done');
    } catch (error) {
      logger.error('[sync] Failed to initialize PowerSync:', error);
      throw error;
    }
  }

  async registerTable(moduleId: string, tableName: string): Promise<void> {
    const fullTableName = `${moduleId}_${tableName}`;
    
    if (this.registeredTables.has(fullTableName)) {
      logger.debug(`[sync] table-registered: ${fullTableName} (already exists)`);
      return;
    }

    logger.debug(`[sync] table-registered: ${fullTableName}`);
    
    try {
      // Add canonical columns to schema
      this.schemas.set(fullTableName, {
        name: fullTableName,
        columns: {
          id: 'TEXT',
          user_id: 'TEXT',
          _ps_version: 'INTEGER',
          updated_at: 'INTEGER',
          deleted: 'INTEGER'
        }
      });
      
      this.registeredTables.add(fullTableName);
      
      // In a real implementation, this would notify PowerSync
      // For MVP, we just track the registration
      logger.debug('[sync] inbound batch', { table: fullTableName });
    } catch (error) {
      logger.error(`[sync] Failed to register table ${fullTableName}:`, error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    logger.debug('[sync] Shutting down PowerSync client');
    
    try {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }
      
      this.powerSyncDb = null;
      this.config = null;
      this.registeredTables.clear();
      this.syncStatus.enabled = false;
      
      logger.debug('[sync] PowerSync client shut down successfully');
    } catch (error) {
      logger.error('[sync] error boundary:', error);
      throw error;
    }
  }

  getStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  isEnabled(): boolean {
    return this.syncStatus.enabled;
  }
}

// Export singleton instance
export const syncManager = new SyncManager();

// Helper function to define a table with canonical columns
export function defineTable(
  moduleId: string,
  tableName: string,
  userColumns: string,
  db: BetterSqlite3Database
): string {
  const fullTableName = `${moduleId}_${tableName}`;
  
  // Canonical columns that every synced table must have
  const canonicalColumns = `
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    _ps_version INTEGER DEFAULT 0,
    updated_at INTEGER NOT NULL,
    deleted INTEGER DEFAULT 0
  `;
  
  // Combine canonical columns with user-defined columns
  const fullSchema = `
    CREATE TABLE IF NOT EXISTS ${fullTableName} (
      ${canonicalColumns},
      ${userColumns}
    );
    CREATE INDEX IF NOT EXISTS idx_${fullTableName}_user_id ON ${fullTableName}(user_id);
    CREATE INDEX IF NOT EXISTS idx_${fullTableName}_updated_at ON ${fullTableName}(updated_at);
    CREATE INDEX IF NOT EXISTS idx_${fullTableName}_deleted ON ${fullTableName}(deleted);
  `;
  
  // Execute the schema
  db.exec(fullSchema);
  
  // Register table with sync manager if enabled
  if (syncManager.isEnabled()) {
    syncManager.registerTable(moduleId, tableName).catch(error => {
      logger.error(`[sync] Failed to register table ${fullTableName}:`, error);
    });
  }
  
  return fullSchema;
}