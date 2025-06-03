/**
 * Database System for The Roommates Helper
 * ---------------------------------------
 * Centralized database setup and management
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { logWithEmoji } from '../utils';

//=============================================================================
// CONFIGURATION
//=============================================================================

const DB_PATH = process.env.DATABASE_PATH || './data/bot.db';
const MIGRATIONS_PATH = './src/database/migrations';

// Global database instance
let db: Database.Database | null = null;

//=============================================================================
// DATABASE SETUP
//=============================================================================

/**
 * Setup and initialize the database
 */
export async function setupDatabase(): Promise<void> {
  try {
    logWithEmoji('info', 'Setting up database...', 'Database');
    
    // Ensure data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      logWithEmoji('info', `Created data directory: ${dataDir}`, 'Database');
    }

    // Initialize database connection
    db = new Database(DB_PATH);
    
    // Enable foreign key constraints
    db.pragma('foreign_keys = ON');
    
    // Set WAL mode for better concurrent access
    db.pragma('journal_mode = WAL');
    
    logWithEmoji('success', `Database connected: ${DB_PATH}`, 'Database');
    
    // Run migrations
    await runMigrations();
    
    logWithEmoji('success', 'Database setup complete', 'Database');
    
  } catch (error) {
    logWithEmoji('error', `Database setup failed: ${error}`, 'Database');
    throw error;
  }
}

/**
 * Initialize database (alias for setupDatabase for compatibility)
 */
export async function initializeDatabase(): Promise<void> {
  return setupDatabase();
}

/**
 * Get the database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call setupDatabase() first.');
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    try {
      db.close();
      logWithEmoji('info', 'Database connection closed', 'Database');
    } catch (error) {
      logWithEmoji('error', `Error closing database: ${error}`, 'Database');
    }
  }
  db = null;
}

//=============================================================================
// MIGRATION SYSTEM
//=============================================================================

/**
 * Run database migrations
 */
async function runMigrations(): Promise<void> {
  try {
    if (!db) throw new Error('Database not initialized');
    
    logWithEmoji('info', 'Running database migrations...', 'Database');
    
    // Create migrations table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of executed migrations
    const executedMigrations = db
      .prepare('SELECT filename FROM migrations ORDER BY filename')
      .all()
      .map((row: any) => row.filename);

    // Get list of migration files
    const migrationFiles = fs.existsSync(MIGRATIONS_PATH) 
      ? fs.readdirSync(MIGRATIONS_PATH)
          .filter(file => file.endsWith('.sql'))
          .sort()
      : [];

    if (migrationFiles.length === 0) {
      logWithEmoji('warn', 'No migration files found', 'Database');
      return;
    }

    // Execute pending migrations
    let migrationsRun = 0;
    for (const filename of migrationFiles) {
      if (!executedMigrations.includes(filename)) {
        const migrationPath = path.join(MIGRATIONS_PATH, filename);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        logWithEmoji('info', `Running migration: ${filename}`, 'Database');
        
        // Execute migration in a transaction
        const transaction = db.transaction(() => {
          db!.exec(migrationSQL);
          db!
            .prepare('INSERT INTO migrations (filename) VALUES (?)')
            .run(filename);
        });
        
        transaction();
        migrationsRun++;
        logWithEmoji('success', `Migration completed: ${filename}`, 'Database');
      }
    }
    
    if (migrationsRun === 0) {
      logWithEmoji('info', 'Database is up to date (no migrations needed)', 'Database');
    } else {
      logWithEmoji('success', `Completed ${migrationsRun} database migration(s)`, 'Database');
    }
    
  } catch (error) {
    logWithEmoji('error', `Migration failed: ${error}`, 'Database');
    throw error;
  }
}

//=============================================================================
// QUERY UTILITIES
//=============================================================================

/**
 * Execute a query with error handling
 */
export function executeQuery<T = any>(
  query: string, 
  params: any[] = []
): T[] {
  try {
    const database = getDatabase();
    const stmt = database.prepare(query);
    const result = stmt.all(...params);
    return result as T[];
  } catch (error) {
    logWithEmoji('error', `Query execution failed: ${error}`, 'Database');
    logWithEmoji('error', `Query: ${query}`, 'Database');
    logWithEmoji('error', `Params: ${JSON.stringify(params)}`, 'Database');
    throw error;
  }
}

/**
 * Execute a single query and return first result
 */
export function executeQueryOne<T = any>(
  query: string, 
  params: any[] = []
): T | null {
  try {
    const database = getDatabase();
    const stmt = database.prepare(query);
    const result = stmt.get(...params);
    return (result as T) || null;
  } catch (error) {
    logWithEmoji('error', `Query execution failed: ${error}`, 'Database');
    logWithEmoji('error', `Query: ${query}`, 'Database');
    logWithEmoji('error', `Params: ${JSON.stringify(params)}`, 'Database');
    throw error;
  }
}

/**
 * Execute an insert/update/delete query
 */
export function executeUpdate(
  query: string, 
  params: any[] = []
): Database.RunResult {
  try {
    const database = getDatabase();
    const stmt = database.prepare(query);
    const result = stmt.run(...params);
    return result;
  } catch (error) {
    logWithEmoji('error', `Update execution failed: ${error}`, 'Database');
    logWithEmoji('error', `Query: ${query}`, 'Database');
    logWithEmoji('error', `Params: ${JSON.stringify(params)}`, 'Database');
    throw error;
  }
}

/**
 * Execute multiple operations in a transaction
 */
export function executeTransaction(operations: () => void): void {
  try {
    const database = getDatabase();
    const transaction = database.transaction(operations);
    transaction();
  } catch (error) {
    logWithEmoji('error', `Transaction failed: ${error}`, 'Database');
    throw error;
  }
}

//=============================================================================
// BACKUP & MAINTENANCE
//=============================================================================

/**
 * Backup the database
 */
export function backupDatabase(backupPath?: string): string {
  try {
    const database = getDatabase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultBackupPath = `./data/backups/bot-backup-${timestamp}.db`;
    const finalBackupPath = backupPath || defaultBackupPath;
    
    // Ensure backup directory exists
    const backupDir = path.dirname(finalBackupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Create backup
    database.backup(finalBackupPath);
    logWithEmoji('success', `Database backed up to: ${finalBackupPath}`, 'Database');
    
    return finalBackupPath;
  } catch (error) {
    logWithEmoji('error', `Database backup failed: ${error}`, 'Database');
    throw error;
  }
}

/**
 * Get database statistics
 */
export function getDatabaseStats(): any {
  try {
    const database = getDatabase();
    
    // Get table information
    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all();
    
    const stats: any = {
      tables: {},
      totalRows: 0,
      databaseSize: fs.statSync(DB_PATH).size
    };
    
    // Get row counts for each table
    for (const table of tables as any[]) {
      const count = database
        .prepare(`SELECT COUNT(*) as count FROM ${table.name}`)
        .get() as any;
      
      stats.tables[table.name] = count.count;
      stats.totalRows += count.count;
    }
    
    return stats;
  } catch (error) {
    logWithEmoji('error', `Failed to get database stats: ${error}`, 'Database');
    throw error;
  }
}

/**
 * Health check for the database
 */
export function checkDatabaseHealth(): boolean {
  try {
    const database = getDatabase();
    
    // Simple query to check if database is responsive
    const result = database.prepare('SELECT 1 as test').get() as any;
    
    return result && result.test === 1;
  } catch (error) {
    logWithEmoji('error', `Database health check failed: ${error}`, 'Database');
    return false;
  }
}

//=============================================================================
// GRACEFUL SHUTDOWN
//=============================================================================

// Register shutdown handlers
process.on('SIGINT', () => {
  logWithEmoji('info', 'Gracefully closing database connection...', 'Database');
  closeDatabase();
});

process.on('SIGTERM', () => {
  logWithEmoji('info', 'Gracefully closing database connection...', 'Database');
  closeDatabase();
});

process.on('exit', () => {
  closeDatabase();
});

//=============================================================================
// EXPORTS
//=============================================================================

export {
  db,
  DB_PATH,
  MIGRATIONS_PATH
};
