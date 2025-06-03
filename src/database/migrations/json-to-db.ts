/**
 * JSON to Database Migration Script
 * ---------------------------------
 * Migrates existing JSON data to SQLite database
 */

import fs from 'fs';
import path from 'path';
import { initializeDatabase, executeUpdate, executeTransaction, backupDatabase } from '../index';

// File paths for existing JSON data
const JSON_FILES = {
  infractions: './infractions.json',
  verificationConfig: './verification_config.json',
  messageLoggerConfig: './message_logger_config.json',
  health: './health.json'
};

// Backup directory
const BACKUP_DIR = './data/json-backups';

interface OldInfraction {
  id: string;
  userId: string;
  guildId: string;
  moderatorId: string;
  type: string;
  reason: string;
  timestamp: number;
  expiresAt?: number;
  active: boolean;
  appealed?: boolean;
  appealId?: string;
}

interface OldAppeal {
  userId: string;
  caseId: string;
  infractionType: string;
  reason: string;
  status: string;
  timestamp: number;
  reviewerId?: string;
  reviewReason?: string;
  reviewTimestamp?: number;
}

interface OldInfractionDB {
  [guildId: string]: {
    infractions: OldInfraction[];
    appeals: OldAppeal[];
    config: any;
  };
}

interface OldVerificationConfig {
  MOD_CHANNEL_ID?: string;
  AGE_UNVERIFIED_ROLE_ID?: string;
}

interface OldMessageLoggerConfig {
  enabled: boolean;
  logChannelId?: string;
  ignoredChannels: string[];
  ignoredUsers: string[];
  logMessageContent: boolean;
  logDMs: boolean;
  logEdits: boolean;
  logDeletes: boolean;
  logJoins: boolean;
  logLeaves: boolean;
  maxMessageLength: number;
}

interface OldHealthData {
  lastHeartbeat: number;
  status: string;
  startTime?: number;
  uptime?: number;
}

/**
 * Main migration function
 */
export async function migrateJsonToDatabase(): Promise<void> {
  console.log('🔄 Starting JSON to Database migration...');
  
  try {
    // Initialize database
    initializeDatabase();
    
    // Create backup directory
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    
    // Backup existing JSON files
    await backupJsonFiles();
    
    // Run migrations
    await migrateInfractions();
    await migrateVerificationConfig();
    await migrateMessageLoggerConfig();
    await migrateHealthData();
    
    console.log('✅ Migration completed successfully!');
    console.log('📋 Summary:');
    console.log('   - JSON files backed up to:', BACKUP_DIR);
    console.log('   - Database initialized with migrated data');
    console.log('   - Original JSON files preserved for rollback if needed');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Backup existing JSON files
 */
async function backupJsonFiles(): Promise<void> {
  console.log('📦 Backing up existing JSON files...');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  for (const [name, filePath] of Object.entries(JSON_FILES)) {
    if (fs.existsSync(filePath)) {
      const backupPath = path.join(BACKUP_DIR, `${name}-${timestamp}.json`);
      fs.copyFileSync(filePath, backupPath);
      console.log(`   ✅ Backed up ${name}: ${backupPath}`);
    } else {
      console.log(`   ⚠️ File not found: ${filePath}`);
    }
  }
}

/**
 * Migrate infractions and appeals data
 */
async function migrateInfractions(): Promise<void> {
  console.log('🔄 Migrating infractions data...');
  
  if (!fs.existsSync(JSON_FILES.infractions)) {
    console.log('   ⚠️ No infractions file found, skipping...');
    return;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(JSON_FILES.infractions, 'utf8')) as OldInfractionDB;
    
    let totalInfractions = 0;
    let totalAppeals = 0;
    let totalGuilds = 0;
    
    executeTransaction(() => {
      // Migrate each guild's data
      for (const [guildId, guildData] of Object.entries(data)) {
        // Insert guild if not exists
        executeUpdate(`
          INSERT OR IGNORE INTO guilds (id, name) 
          VALUES (?, ?)
        `, [guildId, `Guild ${guildId}`]);
        
        // Insert mod config
        const config = guildData.config || {};
        executeUpdate(`
          INSERT OR REPLACE INTO mod_config (
            guild_id, enabled, moderator_role_id, muted_role_id, 
            log_channel_id, appeal_channel_id, dm_notifications,
            auto_delete, delete_delay, warn_threshold, allow_appeals, appeal_cooldown
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          guildId,
          config.enabled || false,
          config.moderatorRoleId || null,
          config.mutedRoleId || null,
          config.logChannelId || null,
          config.appealChannelId || null,
          config.dmNotifications !== false,
          config.autoDelete !== false,
          config.deleteDelay || 5000,
          config.warnThreshold || 3,
          config.allowAppeals !== false,
          config.appealCooldown || 24
        ]);
        
        // Migrate infractions
        if (guildData.infractions) {
          for (const infraction of guildData.infractions) {
            executeUpdate(`
              INSERT OR REPLACE INTO infractions (
                id, user_id, guild_id, moderator_id, type, reason,
                timestamp, expires_at, active, appealed, appeal_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              infraction.id,
              infraction.userId,
              infraction.guildId,
              infraction.moderatorId,
              infraction.type,
              infraction.reason,
              new Date(infraction.timestamp).toISOString(),
              infraction.expiresAt ? new Date(infraction.expiresAt).toISOString() : null,
              infraction.active,
              infraction.appealed || false,
              infraction.appealId || null
            ]);
            totalInfractions++;
          }
        }
        
        // Migrate appeals
        if (guildData.appeals) {
          for (const appeal of guildData.appeals) {
            const appealId = `${appeal.caseId}_appeal`;
            executeUpdate(`
              INSERT OR REPLACE INTO appeals (
                id, user_id, guild_id, case_id, infraction_type, reason,
                status, timestamp, reviewer_id, review_reason, review_timestamp
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              appealId,
              appeal.userId,
              guildId,
              appeal.caseId,
              appeal.infractionType,
              appeal.reason,
              appeal.status,
              new Date(appeal.timestamp).toISOString(),
              appeal.reviewerId || null,
              appeal.reviewReason || null,
              appeal.reviewTimestamp ? new Date(appeal.reviewTimestamp).toISOString() : null
            ]);
            totalAppeals++;
          }
        }
        
        totalGuilds++;
      }
    });
    
    console.log(`   ✅ Migrated ${totalInfractions} infractions, ${totalAppeals} appeals for ${totalGuilds} guilds`);
    
  } catch (error) {
    console.error('   ❌ Failed to migrate infractions:', error);
    throw error;
  }
}

/**
 * Migrate verification configuration
 */
async function migrateVerificationConfig(): Promise<void> {
  console.log('🔄 Migrating verification config...');
  
  if (!fs.existsSync(JSON_FILES.verificationConfig)) {
    console.log('   ⚠️ No verification config file found, skipping...');
    return;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(JSON_FILES.verificationConfig, 'utf8')) as OldVerificationConfig;
    
    // We need to determine the guild ID - for now, we'll use environment variable or default
    const guildId = process.env.GUILD_ID || process.env.SERVER_ID;
    
    if (!guildId) {
      console.log('   ⚠️ No GUILD_ID found in environment, cannot migrate verification config');
      return;
    }
    
    executeTransaction(() => {
      // Insert guild if not exists
      executeUpdate(`
        INSERT OR IGNORE INTO guilds (id, name) 
        VALUES (?, ?)
      `, [guildId, `Guild ${guildId}`]);
      
      // Insert verification config
      executeUpdate(`
        INSERT OR REPLACE INTO verification_config (
          guild_id, mod_channel_id, age_unverified_role_id, enabled
        ) VALUES (?, ?, ?, ?)
      `, [
        guildId,
        data.MOD_CHANNEL_ID || null,
        data.AGE_UNVERIFIED_ROLE_ID || null,
        true
      ]);
    });
    
    console.log(`   ✅ Migrated verification config for guild ${guildId}`);
    
  } catch (error) {
    console.error('   ❌ Failed to migrate verification config:', error);
    throw error;
  }
}

/**
 * Migrate message logger configuration
 */
async function migrateMessageLoggerConfig(): Promise<void> {
  console.log('🔄 Migrating message logger config...');
  
  if (!fs.existsSync(JSON_FILES.messageLoggerConfig)) {
    console.log('   ⚠️ No message logger config file found, skipping...');
    return;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(JSON_FILES.messageLoggerConfig, 'utf8')) as OldMessageLoggerConfig;
    
    // We need to determine the guild ID
    const guildId = process.env.GUILD_ID || process.env.SERVER_ID;
    
    if (!guildId) {
      console.log('   ⚠️ No GUILD_ID found in environment, cannot migrate message logger config');
      return;
    }
    
    executeTransaction(() => {
      // Insert guild if not exists
      executeUpdate(`
        INSERT OR IGNORE INTO guilds (id, name) 
        VALUES (?, ?)
      `, [guildId, `Guild ${guildId}`]);
      
      // Insert message logger config
      executeUpdate(`
        INSERT OR REPLACE INTO message_logger_config (
          guild_id, enabled, log_channel_id, ignored_channels, ignored_users,
          log_message_content, log_dms, log_edits, log_deletes, log_joins, log_leaves, max_message_length
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        guildId,
        data.enabled,
        data.logChannelId || null,
        JSON.stringify(data.ignoredChannels || []),
        JSON.stringify(data.ignoredUsers || []),
        data.logMessageContent !== false,
        data.logDMs || false,
        data.logEdits !== false,
        data.logDeletes !== false,
        data.logJoins !== false,
        data.logLeaves !== false,
        data.maxMessageLength || 1000
      ]);
    });
    
    console.log(`   ✅ Migrated message logger config for guild ${guildId}`);
    
  } catch (error) {
    console.error('   ❌ Failed to migrate message logger config:', error);
    throw error;
  }
}

/**
 * Migrate health data
 */
async function migrateHealthData(): Promise<void> {
  console.log('🔄 Migrating health data...');
  
  if (!fs.existsSync(JSON_FILES.health)) {
    console.log('   ⚠️ No health file found, using defaults...');
    return;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(JSON_FILES.health, 'utf8')) as OldHealthData;
    
    executeUpdate(`
      UPDATE bot_health SET 
        last_heartbeat = ?,
        status = ?,
        start_time = ?,
        uptime = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `, [
      new Date(data.lastHeartbeat).toISOString(),
      data.status || 'offline',
      data.startTime ? new Date(data.startTime).toISOString() : new Date().toISOString(),
      data.uptime || 0
    ]);
    
    console.log(`   ✅ Migrated health data`);
    
  } catch (error) {
    console.error('   ❌ Failed to migrate health data:', error);
    throw error;
  }
}

/**
 * Rollback migration (restore from JSON files)
 */
export async function rollbackMigration(): Promise<void> {
  console.log('🔄 Rolling back to JSON files...');
  
  try {
    // Find the most recent backup
    const backupFiles = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.endsWith('.json'))
      .sort()
      .reverse();
    
    if (backupFiles.length === 0) {
      throw new Error('No backup files found');
    }
    
    // Get the timestamp from the first backup file
    const timestamp = backupFiles[0].split('-').slice(-1)[0].replace('.json', '');
    
    // Restore each file
    for (const [name, originalPath] of Object.entries(JSON_FILES)) {
      const backupFile = `${name}-${timestamp}.json`;
      const backupPath = path.join(BACKUP_DIR, backupFile);
      
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, originalPath);
        console.log(`   ✅ Restored ${name} from backup`);
      }
    }
    
    console.log('✅ Rollback completed successfully!');
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
}

/**
 * Verify migration integrity
 */
export async function verifyMigration(): Promise<boolean> {
  console.log('🔍 Verifying migration integrity...');
  
  try {
    // Check if infractions data matches
    if (fs.existsSync(JSON_FILES.infractions)) {
      const jsonData = JSON.parse(fs.readFileSync(JSON_FILES.infractions, 'utf8')) as OldInfractionDB;
      
      let jsonInfractionCount = 0;
      let jsonAppealCount = 0;
      
      for (const guildData of Object.values(jsonData)) {
        jsonInfractionCount += guildData.infractions?.length || 0;
        jsonAppealCount += guildData.appeals?.length || 0;
      }
      
      // Count database records
      const dbInfractions = executeUpdate('SELECT COUNT(*) as count FROM infractions', []) as any;
      const dbAppeals = executeUpdate('SELECT COUNT(*) as count FROM appeals', []) as any;
      
      console.log(`   📊 Infractions: JSON(${jsonInfractionCount}) vs DB(${dbInfractions.count})`);
      console.log(`   📊 Appeals: JSON(${jsonAppealCount}) vs DB(${dbAppeals.count})`);
      
      if (jsonInfractionCount !== dbInfractions.count || jsonAppealCount !== dbAppeals.count) {
        console.log('   ⚠️ Data count mismatch detected');
        return false;
      }
    }
    
    console.log('   ✅ Migration integrity verified');
    return true;
    
  } catch (error) {
    console.error('   ❌ Verification failed:', error);
    return false;
  }
}

// Export for use in CLI or bot startup
if (require.main === module) {
  migrateJsonToDatabase()
    .then(() => {
      console.log('Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
