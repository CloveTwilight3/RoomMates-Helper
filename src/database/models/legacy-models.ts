/**
 * Database Models
 * ---------------
 * Data access layer for all database operations
 */

import { executeQuery, executeQueryOne, executeUpdate, executeTransaction } from '../index';

//=============================================================================
// TYPES AND INTERFACES
//=============================================================================

export interface Guild {
  id: string;
  name: string;
  icon_url?: string;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface VerificationConfig {
  guild_id: string;
  mod_channel_id?: string;
  age_unverified_role_id?: string;
  nsfw_access_role_id?: string;
  nsfw_no_access_role_id?: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageLoggerConfig {
  guild_id: string;
  enabled: boolean;
  log_channel_id?: string;
  ignored_channels: string; // JSON string
  ignored_users: string;    // JSON string
  log_message_content: boolean;
  log_dms: boolean;
  log_edits: boolean;
  log_deletes: boolean;
  log_joins: boolean;
  log_leaves: boolean;
  max_message_length: number;
  created_at: string;
  updated_at: string;
}

export interface Infraction {
  id: string;
  user_id: string;
  guild_id: string;
  moderator_id: string;
  type: 'WARNING' | 'MUTE' | 'UNMUTE' | 'BAN' | 'UNBAN' | 'KICK' | 'NOTE';
  reason: string;
  timestamp: string;
  expires_at?: string;
  active: boolean;
  appealed: boolean;
  appeal_id?: string;
}

export interface Appeal {
  id: string;
  user_id: string;
  guild_id: string;
  case_id: string;
  infraction_type: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  timestamp: string;
  reviewer_id?: string;
  review_reason?: string;
  review_timestamp?: string;
}

export interface ModConfig {
  guild_id: string;
  enabled: boolean;
  moderator_role_id?: string;
  muted_role_id?: string;
  log_channel_id?: string;
  appeal_channel_id?: string;
  dm_notifications: boolean;
  auto_delete: boolean;
  delete_delay: number;
  warn_threshold: number;
  allow_appeals: boolean;
  appeal_cooldown: number;
  created_at: string;
  updated_at: string;
}

export interface BotHealth {
  id: number;
  last_heartbeat: string;
  status: 'online' | 'offline' | 'starting' | 'updating';
  start_time: string;
  uptime: number;
  version: string;
  updated_at: string;
}

//=============================================================================
// GUILD OPERATIONS
//=============================================================================

export class GuildModel {
  static async upsert(id: string, name: string, iconUrl?: string, memberCount?: number): Promise<void> {
    executeUpdate(`
      INSERT OR REPLACE INTO guilds (id, name, icon_url, member_count)
      VALUES (?, ?, ?, ?)
    `, [id, name, iconUrl || null, memberCount || 0]);
  }

  static async getById(id: string): Promise<Guild | null> {
    return executeQueryOne<Guild>(`
      SELECT * FROM guilds WHERE id = ?
    `, [id]);
  }

  static async getAll(): Promise<Guild[]> {
    return executeQuery<Guild>(`
      SELECT * FROM guilds ORDER BY name
    `);
  }

  static async updateMemberCount(id: string, count: number): Promise<void> {
    executeUpdate(`
      UPDATE guilds SET member_count = ? WHERE id = ?
    `, [count, id]);
  }
}

//=============================================================================
// VERIFICATION CONFIG OPERATIONS
//=============================================================================

export class VerificationConfigModel {
  static async upsert(config: Partial<VerificationConfig> & { guild_id: string }): Promise<void> {
    executeUpdate(`
      INSERT OR REPLACE INTO verification_config (
        guild_id, mod_channel_id, age_unverified_role_id, 
        nsfw_access_role_id, nsfw_no_access_role_id, enabled
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      config.guild_id,
      config.mod_channel_id || null,
      config.age_unverified_role_id || null,
      config.nsfw_access_role_id || null,
      config.nsfw_no_access_role_id || null,
      config.enabled !== false
    ]);
  }

  static async getByGuildId(guildId: string): Promise<VerificationConfig | null> {
    return executeQueryOne<VerificationConfig>(`
      SELECT * FROM verification_config WHERE guild_id = ?
    `, [guildId]);
  }

  static async setModChannel(guildId: string, channelId: string): Promise<void> {
    executeUpdate(`
      INSERT OR REPLACE INTO verification_config (guild_id, mod_channel_id, enabled)
      VALUES (?, ?, TRUE)
    `, [guildId, channelId]);
  }

  static async setAgeUnverifiedRole(guildId: string, roleId: string): Promise<void> {
    executeUpdate(`
      UPDATE verification_config 
      SET age_unverified_role_id = ? 
      WHERE guild_id = ?
    `, [roleId, guildId]);
  }
}

//=============================================================================
// MESSAGE LOGGER CONFIG OPERATIONS
//=============================================================================

export class MessageLoggerConfigModel {
  static async upsert(config: Partial<MessageLoggerConfig> & { guild_id: string }): Promise<void> {
    const ignoredChannels = Array.isArray(config.ignored_channels) 
      ? JSON.stringify(config.ignored_channels) 
      : config.ignored_channels || '[]';
    
    const ignoredUsers = Array.isArray(config.ignored_users)
      ? JSON.stringify(config.ignored_users)
      : config.ignored_users || '[]';

    executeUpdate(`
      INSERT OR REPLACE INTO message_logger_config (
        guild_id, enabled, log_channel_id, ignored_channels, ignored_users,
        log_message_content, log_dms, log_edits, log_deletes, 
        log_joins, log_leaves, max_message_length
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      config.guild_id,
      config.enabled || false,
      config.log_channel_id || null,
      ignoredChannels,
      ignoredUsers,
      config.log_message_content !== false,
      config.log_dms || false,
      config.log_edits !== false,
      config.log_deletes !== false,
      config.log_joins !== false,
      config.log_leaves !== false,
      config.max_message_length || 1000
    ]);
  }

  static async getByGuildId(guildId: string): Promise<MessageLoggerConfig | null> {
    const config = executeQueryOne<MessageLoggerConfig>(`
      SELECT * FROM message_logger_config WHERE guild_id = ?
    `, [guildId]);

    if (config) {
      // Parse JSON fields
      try {
        (config as any).ignoredChannelsParsed = JSON.parse(config.ignored_channels);
        (config as any).ignoredUsersParsed = JSON.parse(config.ignored_users);
      } catch (error) {
        console.error('Error parsing JSON fields in message logger config:', error);
        (config as any).ignoredChannelsParsed = [];
        (config as any).ignoredUsersParsed = [];
      }
    }

    return config;
  }

  static async enable(guildId: string): Promise<void> {
    executeUpdate(`
      UPDATE message_logger_config SET enabled = TRUE WHERE guild_id = ?
    `, [guildId]);
  }

  static async disable(guildId: string): Promise<void> {
    executeUpdate(`
      UPDATE message_logger_config SET enabled = FALSE WHERE guild_id = ?
    `, [guildId]);
  }

  static async setLogChannel(guildId: string, channelId: string): Promise<void> {
    executeUpdate(`
      INSERT OR REPLACE INTO message_logger_config (guild_id, log_channel_id, enabled)
      VALUES (?, ?, TRUE)
    `, [guildId, channelId]);
  }
}

//=============================================================================
// INFRACTION OPERATIONS
//=============================================================================

export class InfractionModel {
  static async create(infraction: Omit<Infraction, 'timestamp'>): Promise<void> {
    executeUpdate(`
      INSERT INTO infractions (
        id, user_id, guild_id, moderator_id, type, reason,
        expires_at, active, appealed, appeal_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      infraction.id,
      infraction.user_id,
      infraction.guild_id,
      infraction.moderator_id,
      infraction.type,
      infraction.reason,
      infraction.expires_at || null,
      infraction.active,
      infraction.appealed || false,
      infraction.appeal_id || null
    ]);
  }

  static async getById(id: string): Promise<Infraction | null> {
    return executeQueryOne<Infraction>(`
      SELECT * FROM infractions WHERE id = ?
    `, [id]);
  }

  static async getByUser(guildId: string, userId: string): Promise<Infraction[]> {
    return executeQuery<Infraction>(`
      SELECT * FROM infractions 
      WHERE guild_id = ? AND user_id = ?
      ORDER BY timestamp DESC
    `, [guildId, userId]);
  }

  static async getActiveByUser(guildId: string, userId: string): Promise<Infraction[]> {
    return executeQuery<Infraction>(`
      SELECT * FROM infractions 
      WHERE guild_id = ? AND user_id = ? AND active = TRUE
      ORDER BY timestamp DESC
    `, [guildId, userId]);
  }

  static async getWarningsByUser(guildId: string, userId: string): Promise<Infraction[]> {
    return executeQuery<Infraction>(`
      SELECT * FROM infractions 
      WHERE guild_id = ? AND user_id = ? AND type = 'WARNING'
      ORDER BY timestamp DESC
    `, [guildId, userId]);
  }

  static async getActiveWarningsByUser(guildId: string, userId: string): Promise<Infraction[]> {
    return executeQuery<Infraction>(`
      SELECT * FROM infractions 
      WHERE guild_id = ? AND user_id = ? AND type = 'WARNING' AND active = TRUE
      ORDER BY timestamp DESC
    `, [guildId, userId]);
  }

  static async update(id: string, updates: Partial<Infraction>): Promise<boolean> {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    
    const result = executeUpdate(`
      UPDATE infractions SET ${fields} WHERE id = ?
    `, [...values, id]);
    
    return result.changes > 0;
  }

  static async setInactive(id: string): Promise<boolean> {
    const result = executeUpdate(`
      UPDATE infractions SET active = FALSE WHERE id = ?
    `, [id]);
    
    return result.changes > 0;
  }

  static async clearActiveWarnings(guildId: string, userId: string): Promise<number> {
    const result = executeUpdate(`
      UPDATE infractions 
      SET active = FALSE 
      WHERE guild_id = ? AND user_id = ? AND type = 'WARNING' AND active = TRUE
    `, [guildId, userId]);
    
    return result.changes;
  }
}

//=============================================================================
// APPEAL OPERATIONS
//=============================================================================

export class AppealModel {
  static async create(appeal: Omit<Appeal, 'timestamp'>): Promise<void> {
    executeUpdate(`
      INSERT INTO appeals (
        id, user_id, guild_id, case_id, infraction_type, reason, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      appeal.id,
      appeal.user_id,
      appeal.guild_id,
      appeal.case_id,
      appeal.infraction_type,
      appeal.reason,
      appeal.status
    ]);
  }

  static async getById(id: string): Promise<Appeal | null> {
    return executeQueryOne<Appeal>(`
      SELECT * FROM appeals WHERE id = ?
    `, [id]);
  }

  static async getByCaseId(caseId: string): Promise<Appeal | null> {
    return executeQueryOne<Appeal>(`
      SELECT * FROM appeals WHERE case_id = ?
    `, [caseId]);
  }

  static async getByUser(guildId: string, userId: string): Promise<Appeal[]> {
    return executeQuery<Appeal>(`
      SELECT * FROM appeals 
      WHERE guild_id = ? AND user_id = ?
      ORDER BY timestamp DESC
    `, [guildId, userId]);
  }

  static async getPending(guildId?: string): Promise<Appeal[]> {
    if (guildId) {
      return executeQuery<Appeal>(`
        SELECT * FROM appeals 
        WHERE guild_id = ? AND status = 'PENDING'
        ORDER BY timestamp ASC
      `, [guildId]);
    } else {
      return executeQuery<Appeal>(`
        SELECT * FROM appeals 
        WHERE status = 'PENDING'
        ORDER BY timestamp ASC
      `);
    }
  }

  static async update(id: string, updates: Partial<Appeal>): Promise<boolean> {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    
    const result = executeUpdate(`
      UPDATE appeals SET ${fields} WHERE id = ?
    `, [...values, id]);
    
    return result.changes > 0;
  }

  static async resolve(id: string, status: 'APPROVED' | 'DENIED', reviewerId: string, reason: string): Promise<boolean> {
    const result = executeUpdate(`
      UPDATE appeals 
      SET status = ?, reviewer_id = ?, review_reason = ?, review_timestamp = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, reviewerId, reason, id]);
    
    return result.changes > 0;
  }
}

//=============================================================================
// MOD CONFIG OPERATIONS
//=============================================================================

export class ModConfigModel {
  static async upsert(config: Partial<ModConfig> & { guild_id: string }): Promise<void> {
    executeUpdate(`
      INSERT OR REPLACE INTO mod_config (
        guild_id, enabled, moderator_role_id, muted_role_id, log_channel_id,
        appeal_channel_id, dm_notifications, auto_delete, delete_delay,
        warn_threshold, allow_appeals, appeal_cooldown
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      config.guild_id,
      config.enabled || false,
      config.moderator_role_id || null,
      config.muted_role_id || null,
      config.log_channel_id || null,
      config.appeal_channel_id || null,
      config.dm_notifications !== false,
      config.auto_delete !== false,
      config.delete_delay || 5000,
      config.warn_threshold || 3,
      config.allow_appeals !== false,
      config.appeal_cooldown || 24
    ]);
  }

  static async getByGuildId(guildId: string): Promise<ModConfig | null> {
    return executeQueryOne<ModConfig>(`
      SELECT * FROM mod_config WHERE guild_id = ?
    `, [guildId]);
  }

  static async enable(guildId: string): Promise<void> {
    executeUpdate(`
      INSERT OR REPLACE INTO mod_config (guild_id, enabled)
      VALUES (?, TRUE)
    `, [guildId]);
  }

  static async disable(guildId: string): Promise<void> {
    executeUpdate(`
      UPDATE mod_config SET enabled = FALSE WHERE guild_id = ?
    `, [guildId]);
  }

  static async updateField(guildId: string, field: string, value: any): Promise<void> {
    const allowedFields = [
      'moderator_role_id', 'muted_role_id', 'log_channel_id', 'appeal_channel_id',
      'dm_notifications', 'auto_delete', 'delete_delay', 'warn_threshold', 
      'allow_appeals', 'appeal_cooldown'
    ];

    if (!allowedFields.includes(field)) {
      throw new Error(`Invalid field: ${field}`);
    }

    executeUpdate(`
      UPDATE mod_config SET ${field} = ? WHERE guild_id = ?
    `, [value, guildId]);
  }
}

//=============================================================================
// BOT HEALTH OPERATIONS
//=============================================================================

export class BotHealthModel {
  static async updateStatus(status: 'online' | 'offline' | 'starting' | 'updating'): Promise<void> {
    executeUpdate(`
      UPDATE bot_health 
      SET status = ?, last_heartbeat = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `, [status]);
  }

  static async updateHeartbeat(): Promise<void> {
    executeUpdate(`
      UPDATE bot_health 
      SET last_heartbeat = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `, []);
  }

  static async updateUptime(startTime: number): Promise<void> {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    executeUpdate(`
      UPDATE bot_health 
      SET uptime = ?, last_heartbeat = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `, [uptime]);
  }

  static async get(): Promise<BotHealth | null> {
    return executeQueryOne<BotHealth>(`
      SELECT * FROM bot_health WHERE id = 1
    `);
  }

  static async setStartTime(startTime: number): Promise<void> {
    executeUpdate(`
      UPDATE bot_health 
      SET start_time = ?, status = 'starting', updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `, [new Date(startTime).toISOString()]);
  }
}

//=============================================================================
// STATISTICS OPERATIONS (for future server stats feature)
//=============================================================================

export class ServerStatsModel {
  static async recordDailyStats(
    guildId: string, 
    date: string, 
    channelId: string | null, 
    messageCount: number = 0,
    joinCount: number = 0,
    leaveCount: number = 0,
    activeUsers: number = 0,
    moderationActions: number = 0
  ): Promise<void> {
    executeUpdate(`
      INSERT OR REPLACE INTO server_stats_daily (
        guild_id, date, channel_id, message_count, join_count, 
        leave_count, active_users, moderation_actions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [guildId, date, channelId, messageCount, joinCount, leaveCount, activeUsers, moderationActions]);
  }

  static async getStatsForDateRange(
    guildId: string, 
    startDate: string, 
    endDate: string
  ): Promise<any[]> {
    return executeQuery(`
      SELECT * FROM server_stats_daily 
      WHERE guild_id = ? AND date BETWEEN ? AND ?
      ORDER BY date, channel_id
    `, [guildId, startDate, endDate]);
  }

  static async getWeeklyStats(guildId: string, weekStart: string): Promise<any[]> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    return executeQuery(`
      SELECT 
        SUM(message_count) as total_messages,
        SUM(join_count) as total_joins,
        SUM(leave_count) as total_leaves,
        AVG(active_users) as avg_active_users,
        SUM(moderation_actions) as total_mod_actions,
        COUNT(DISTINCT channel_id) as active_channels
      FROM server_stats_daily 
      WHERE guild_id = ? AND date BETWEEN ? AND ?
    `, [guildId, weekStart, weekEnd.toISOString().split('T')[0]]);
  }

  static async recordActiveUser(guildId: string, userId: string, date: string, channelId: string): Promise<void> {
    // First, get current data
    const existing = executeQueryOne(`
      SELECT channels_active, message_count FROM active_users_daily 
      WHERE guild_id = ? AND user_id = ? AND date = ?
    `, [guildId, userId, date]);

    if (existing) {
      // Update existing record
      const channels = JSON.parse(existing.channels_active || '[]');
      if (!channels.includes(channelId)) {
        channels.push(channelId);
      }
      
      executeUpdate(`
        UPDATE active_users_daily 
        SET message_count = message_count + 1, channels_active = ?
        WHERE guild_id = ? AND user_id = ? AND date = ?
      `, [JSON.stringify(channels), guildId, userId, date]);
    } else {
      // Create new record
      executeUpdate(`
        INSERT INTO active_users_daily (guild_id, user_id, date, message_count, channels_active)
        VALUES (?, ?, ?, 1, ?)
      `, [guildId, userId, date, JSON.stringify([channelId])]);
    }
  }
}

//=============================================================================
// UTILITY FUNCTIONS
//=============================================================================

/**
 * Initialize all guild-related configs with defaults
 */
export async function initializeGuildConfigs(guildId: string, guildName: string): Promise<void> {
  executeTransaction(() => {
    // Ensure guild exists
    GuildModel.upsert(guildId, guildName);
    
    // Initialize configs with defaults if they don't exist
    executeUpdate(`
      INSERT OR IGNORE INTO verification_config (guild_id, enabled)
      VALUES (?, FALSE)
    `, [guildId]);
    
    executeUpdate(`
      INSERT OR IGNORE INTO message_logger_config (guild_id, enabled)
      VALUES (?, FALSE)
    `, [guildId]);
    
    executeUpdate(`
      INSERT OR IGNORE INTO mod_config (guild_id, enabled)
      VALUES (?, FALSE)
    `, [guildId]);
  });
}

/**
 * Get complete guild configuration
 */
export async function getGuildConfiguration(guildId: string): Promise<{
  guild: Guild | null;
  verification: VerificationConfig | null;
  messageLogger: MessageLoggerConfig | null;
  moderation: ModConfig | null;
}> {
  return {
    guild: await GuildModel.getById(guildId),
    verification: await VerificationConfigModel.getByGuildId(guildId),
    messageLogger: await MessageLoggerConfigModel.getByGuildId(guildId),
    moderation: await ModConfigModel.getByGuildId(guildId)
  };
}

/**
 * Generate a unique case ID for infractions
 */
export function generateCaseId(guildId: string): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${guildId}-${timestamp}-${random}`;
}

/**
 * Get user infraction summary
 */
export async function getUserInfractionSummary(guildId: string, userId: string): Promise<{
  totalInfractions: number;
  activeInfractions: number;
  activeWarnings: number;
  activeMutes: number;
  activeBans: number;
  lastInfraction?: string;
}> {
  const result = executeQueryOne(`
    SELECT 
      COUNT(*) as total_infractions,
      COUNT(CASE WHEN active = 1 THEN 1 END) as active_infractions,
      COUNT(CASE WHEN type = 'WARNING' AND active = 1 THEN 1 END) as active_warnings,
      COUNT(CASE WHEN type = 'MUTE' AND active = 1 THEN 1 END) as active_mutes,
      COUNT(CASE WHEN type = 'BAN' AND active = 1 THEN 1 END) as active_bans,
      MAX(timestamp) as last_infraction
    FROM infractions
    WHERE guild_id = ? AND user_id = ?
  `, [guildId, userId]);

  return {
    totalInfractions: result?.total_infractions || 0,
    activeInfractions: result?.active_infractions || 0,
    activeWarnings: result?.active_warnings || 0,
    activeMutes: result?.active_mutes || 0,
    activeBans: result?.active_bans || 0,
    lastInfraction: result?.last_infraction || undefined
  };
}

/**
 * Clean up expired mutes/bans
 */
export async function cleanupExpiredInfractions(): Promise<number> {
  const result = executeUpdate(`
    UPDATE infractions 
    SET active = FALSE 
    WHERE active = TRUE 
      AND expires_at IS NOT NULL 
      AND expires_at < CURRENT_TIMESTAMP
      AND type IN ('MUTE', 'BAN')
  `);
  
  return result.changes;
}
