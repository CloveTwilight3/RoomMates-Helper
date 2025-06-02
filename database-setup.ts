/**
 * Database Setup Script
 * ---------------------
 * Sets up the database and migrates from JSON files
 */

import { initializeDatabase, getDatabaseStats, checkDatabaseHealth, backupDatabase } from './database/database';
import { migrateJsonToDatabase, verifyMigration, rollbackMigration } from './migrations/json-to-db';
import fs from 'fs';

// Command line arguments
const args = process.argv.slice(2);
const command = args[0];

async function showHelp(): Promise<void> {
  console.log(`
Database Setup Script for The Roommates Helper Bot

Commands:
  init      - Initialize database with schema
  migrate   - Migrate data from JSON files to database
  verify    - Verify migration integrity
  rollback  - Rollback to JSON files (emergency use)
  backup    - Create database backup
  stats     - Show database statistics
  health    - Check database health
  reset     - Reset database (DANGEROUS - removes all data)

Examples:
  npm run db:init
  npm run db:migrate
  npm run db:verify
  npm run db:backup
  npm run db:stats

For first-time setup, run:
  npm run db:init && npm run db:migrate && npm run db:verify
  `);
}

async function initDatabase(): Promise<void> {
  console.log('🔄 Initializing database...');
  
  try {
    initializeDatabase();
    console.log('✅ Database initialized successfully!');
    
    // Show stats
    const stats = getDatabaseStats();
    console.log('📊 Database Statistics:');
    console.log(`   - Tables: ${Object.keys(stats.tables).length}`);
    console.log(`   - Total rows: ${stats.totalRows}`);
    console.log(`   - Database size: ${(stats.databaseSize / 1024).toFixed(2)} KB`);
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

async function migrateData(): Promise<void> {
  console.log('🔄 Migrating data from JSON files...');
  
  try {
    // Check if database is initialized
    if (!checkDatabaseHealth()) {
      console.log('Database not healthy, initializing first...');
      initializeDatabase();
    }
    
    // Run migration
    await migrateJsonToDatabase();
    
    // Verify migration
    const isValid = await verifyMigration();
    if (isValid) {
      console.log('✅ Migration completed and verified successfully!');
    } else {
      console.log('⚠️ Migration completed but verification found issues');
    }
    
    // Show final stats
    const stats = getDatabaseStats();
    console.log('📊 Post-migration Statistics:');
    console.log(`   - Total rows: ${stats.totalRows}`);
    Object.entries(stats.tables).forEach(([table, count]) => {
      console.log(`   - ${table}: ${count} rows`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

async function verifyData(): Promise<void> {
  console.log('🔍 Verifying migration integrity...');
  
  try {
    const isValid = await verifyMigration();
    if (isValid) {
      console.log('✅ Data integrity verified successfully!');
    } else {
      console.log('❌ Data integrity check failed!');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

async function rollbackData(): Promise<void> {
  console.log('🔄 Rolling back to JSON files...');
  console.log('⚠️ This will restore JSON files from backup');
  
  // Confirm action
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const answer = await new Promise<string>((resolve) => {
    rl.question('Are you sure you want to rollback? (yes/no): ', resolve);
  });
  
  rl.close();
  
  if (answer.toLowerCase() !== 'yes') {
    console.log('Rollback cancelled');
    return;
  }
  
  try {
    await rollbackMigration();
    console.log('✅ Rollback completed successfully!');
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  }
}

async function createBackup(): Promise<void> {
  console.log('🔄 Creating database backup...');
  
  try {
    const backupPath = backupDatabase();
    console.log(`✅ Backup created: ${backupPath}`);
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

async function showStats(): Promise<void> {
  console.log('📊 Database Statistics');
  console.log('='.repeat(50));
  
  try {
    const stats = getDatabaseStats();
    const health = checkDatabaseHealth();
    
    console.log(`Health Status: ${health ? '✅ Healthy' : '❌ Unhealthy'}`);
    console.log(`Database Size: ${(stats.databaseSize / 1024).toFixed(2)} KB`);
    console.log(`Total Rows: ${stats.totalRows}`);
    console.log();
    console.log('Table Breakdown:');
    
    Object.entries(stats.tables).forEach(([table, count]) => {
      console.log(`  ${table.padEnd(25)} ${count.toString().padStart(8)} rows`);
    });
    
  } catch (error) {
    console.error('❌ Failed to get stats:', error);
    process.exit(1);
  }
}

async function checkHealth(): Promise<void> {
  console.log('🏥 Database Health Check');
  console.log('='.repeat(50));
  
  try {
    const isHealthy = checkDatabaseHealth();
    
    if (isHealthy) {
      console.log('✅ Database is healthy and responsive');
    } else {
      console.log('❌ Database health check failed');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  }
}

async function resetDatabase(): Promise<void> {
  console.log('⚠️ DATABASE RESET - THIS WILL DELETE ALL DATA!');
  
  // Confirm action
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const answer = await new Promise<string>((resolve) => {
    rl.question('Type "DELETE ALL DATA" to confirm reset: ', resolve);
  });
  
  rl.close();
  
  if (answer !== 'DELETE ALL DATA') {
    console.log('Reset cancelled');
    return;
  }
  
  try {
    // Create backup first
    console.log('Creating backup before reset...');
    const backupPath = backupDatabase();
    console.log(`Backup created: ${backupPath}`);
    
    // Delete database file
    const dbPath = process.env.DATABASE_PATH || './data/bot.db';
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log('Database file deleted');
    }
    
    // Reinitialize
    initializeDatabase();
    console.log('✅ Database reset and reinitialized');
    
  } catch (error) {
    console.error('❌ Reset failed:', error);
    process.exit(1);
  }
}

// Main execution
async function main(): Promise<void> {
  switch (command) {
    case 'init':
      await initDatabase();
      break;
    
    case 'migrate':
      await migrateData();
      break;
    
    case 'verify':
      await verifyData();
      break;
    
    case 'rollback':
      await rollbackData();
      break;
    
    case 'backup':
      await createBackup();
      break;
    
    case 'stats':
      await showStats();
      break;
    
    case 'health':
      await checkHealth();
      break;
    
    case 'reset':
      await resetDatabase();
      break;
    
    case 'help':
    case '--help':
    case '-h':
      await showHelp();
      break;
    
    default:
      console.log('Unknown command. Use "help" for available commands.');
      await showHelp();
      process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}
