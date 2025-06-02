/**
 * Database Core Setup (better-sqlite3 version)
 * --------------------------------------------
 * SQLite database utilities and connection management
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Database configuration
const DB_PATH = process.env.DATABASE_PATH || './data/bot.db';
const MIGRATIONS_PATH = './database/migrations';

// Global database instance
let db: Database.Database | null = null;

/**
 * Initialize the database connection
 */
export function initializeDatabase(): Database.Database {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Create database connection
    db = new Database(DB_PATH);
    
    // Enable foreign key constraints
    db.pragma('foreign_keys = ON');
    
    // Set WAL mode for better concurrent access
    db.pragma('journal_mode = WAL');
    
    console.log(`✅ Database connected: ${DB_PATH}`);
    
    // Run migrations
    runMigrations(db);
    
    return db;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

/**
 * Get the database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('✅ Database connection closed');
  }
}

/**
 * Run database migrations
 */
function runMigrations(database: Database.Database): void {
  try {
    // Create migrations table if it doesn't exist
    database.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of executed migrations
    const executedMigrations = database
      .prepare('SELECT filename FROM migrations ORDER BY filename')
      .all()
      .map((row: any) => row.filename);

    // Get list of migration files
    const migrationFiles = fs.existsSync(MIGRATIONS_PATH) 
      ? fs.readdirSync(MIGRATIONS_PATH)
          .filter(file => file.endsWith('.sql'))
          .sort()
      : [];

    // Execute pending migrations
    let migrationsRun = 0;
    for (const filename of migrationFiles) {
      if (!executedMigrations.includes(filename)) {
        const migrationPath = path.join(MIGRATIONS_PATH, filename);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log(`🔄 Running migration: ${filename}`);
        
        // Execute migration in a transaction
        const transaction = database.transaction(() => {
          database.exec(migrationSQL);
          database
            .prepare('INSERT INTO migrations (filename) VALUES (?)')
            .run(filename);
        });
        
        transaction();
        migrationsRun++;
        console.log(`✅ Migration completed: ${filename}`);
      }
    }
    
    if (migrationsRun === 0) {
      console.log('✅ Database is up to date (no migrations needed)');
    } else {
      console.log(`✅ Completed ${migrationsRun} database migration(s)`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

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
    console.error('❌ Query execution failed:', error);
    console.error('Query:', query);
    console.error('Params:', params);
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
    console.error('❌ Query execution failed:', error);
    console.error('Query:', query);
    console.error('Params:', params);
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
    console.error('❌ Update execution failed:', error);
    console.error('Query:', query);
    console.error('Params:', params);
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
    console.error('❌ Transaction failed:', error);
    throw error;
  }
}

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
    console.log(`✅ Database backed up to: ${finalBackupPath}`);
    
    return finalBackupPath;
  } catch (error) {
    console.error('❌ Database backup failed:', error);
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
    console.error('❌ Failed to get database stats:', error);
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
    console.error('❌ Database health check failed:', error);
    return false;
  }
}

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\n🛑 Gracefully closing database connection...');
  closeDatabase();
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Gracefully closing database connection...');
  closeDatabase();
});

process.on('exit', () => {
  closeDatabase();
});

// Export types for better TypeScript support
export interface DatabaseRow {
  [key: string]: any;
}

export interface MigrationInfo {
  filename: string;
  executed_at: string;
}
