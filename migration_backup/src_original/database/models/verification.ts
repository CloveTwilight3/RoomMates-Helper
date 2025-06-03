/**
 * Verification Database Models
 * ---------------------------
 * Database models for the verification system
 */

import { executeQuery, executeQueryOne, executeUpdate } from '../index';

//=============================================================================
// TYPES
//=============================================================================

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

//=============================================================================
// VERIFICATION CONFIG MODEL
//=============================================================================

export class VerificationConfigModel {
  /**
   * Upsert verification configuration
   */
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

  /**
   * Get verification config by guild ID
   */
  static async getByGuildId(guildId: string): Promise<VerificationConfig | null> {
    return executeQueryOne<VerificationConfig>(`
      SELECT * FROM verification_config WHERE guild_id = ?
    `, [guildId]);
  }

  /**
   * Set mod channel for a guild
   */
  static async setModChannel(guildId: string, channelId: string): Promise<void> {
    // First ensure the guild has a config entry
    const existing = await this.getByGuildId(guildId);
    
    if (!existing) {
      // Create new config
      await this.upsert({
        guild_id: guildId,
        mod_channel_id: channelId,
        enabled: true
      });
    } else {
      // Update existing config
      executeUpdate(`
        UPDATE verification_config 
        SET mod_channel_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE guild_id = ?
      `, [channelId, guildId]);
    }
  }

  /**
   * Set age unverified role for a guild
   */
  static async setAgeUnverifiedRole(guildId: string, roleId: string): Promise<void> {
    // First ensure the guild has a config entry
    const existing = await this.getByGuildId(guildId);
    
    if (!existing) {
      // Create new config
      await this.upsert({
        guild_id: guildId,
        age_unverified_role_id: roleId,
        enabled: true
      });
    } else {
      // Update existing config
      executeUpdate(`
        UPDATE verification_config 
        SET age_unverified_role_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE guild_id = ?
      `, [roleId, guildId]);
    }
  }

  /**
   * Set NSFW access role for a guild
   */
  static async setNsfwAccessRole(guildId: string, roleId: string): Promise<void> {
    const existing = await this.getByGuildId(guildId);
    
    if (!existing) {
      await this.upsert({
        guild_id: guildId,
        nsfw_access_role_id: roleId,
        enabled: true
      });
    } else {
      executeUpdate(`
        UPDATE verification_config 
        SET nsfw_access_role_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE guild_id = ?
      `, [roleId, guildId]);
    }
  }

  /**
   * Set NSFW no access role for a guild
   */
  static async setNsfwNoAccessRole(guildId: string, roleId: string): Promise<void> {
    const existing = await this.getByGuildId(guildId);
    
    if (!existing) {
      await this.upsert({
        guild_id: guildId,
        nsfw_no_access_role_id: roleId,
        enabled: true
      });
    } else {
      executeUpdate(`
        UPDATE verification_config 
        SET nsfw_no_access_role_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE guild_id = ?
      `, [roleId, guildId]);
    }
  }

  /**
   * Enable verification system for a guild
   */
  static async enable(guildId: string): Promise<void> {
    const existing = await this.getByGuildId(guildId);
    
    if (!existing) {
      await this.upsert({
        guild_id: guildId,
        enabled: true
      });
    } else {
      executeUpdate(`
        UPDATE verification_config 
        SET enabled = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE guild_id = ?
      `, [guildId]);
    }
  }

  /**
   * Disable verification system for a guild
   */
  static async disable(guildId: string): Promise<void> {
    executeUpdate(`
      UPDATE verification_config 
      SET enabled = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE guild_id = ?
    `, [guildId]);
  }

  /**
   * Get all enabled verification configs
   */
  static async getAllEnabled(): Promise<VerificationConfig[]> {
    return executeQuery<VerificationConfig>(`
      SELECT * FROM verification_config 
      WHERE enabled = TRUE
      ORDER BY created_at ASC
    `);
  }

  /**
   * Delete verification config for a guild
   */
  static async delete(guildId: string): Promise<void> {
    executeUpdate(`
      DELETE FROM verification_config WHERE guild_id = ?
    `, [guildId]);
  }
}

//=============================================================================
// VERIFICATION LOGS (for future implementation)
//=============================================================================

export interface VerificationLog {
  id: string;
  user_id: string;
  guild_id: string;
  moderator_id?: string;
  action: 'started' | 'submitted' | 'approved' | 'denied' | 'expired';
  timestamp: string;
  metadata?: string; // JSON string
}

export class VerificationLogModel {
  /**
   * Log a verification action
   */
  static async log(
    userId: string, 
    guildId: string, 
    action: string, 
    moderatorId?: string, 
    metadata?: any
  ): Promise<void> {
    const id = `${guildId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    
    executeUpdate(`
      INSERT INTO verification_logs (id, user_id, guild_id, moderator_id, action, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      id,
      userId,
      guildId,
      moderatorId || null,
      action,
      metadata ? JSON.stringify(metadata) : null
    ]);
  }

  /**
   * Get verification logs for a user
   */
  static async getByUser(guildId: string, userId: string): Promise<VerificationLog[]> {
    return executeQuery<VerificationLog>(`
      SELECT * FROM verification_logs 
      WHERE guild_id = ? AND user_id = ?
      ORDER BY timestamp DESC
    `, [guildId, userId]);
  }

  /**
   * Get recent verification logs for a guild
   */
  static async getRecent(guildId: string, limit: number = 50): Promise<VerificationLog[]> {
    return executeQuery<VerificationLog>(`
      SELECT * FROM verification_logs 
      WHERE guild_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `, [guildId, limit]);
  }
}

//=============================================================================
// EXPORTS
//=============================================================================

export {
  VerificationConfigModel,
  VerificationLogModel
};
