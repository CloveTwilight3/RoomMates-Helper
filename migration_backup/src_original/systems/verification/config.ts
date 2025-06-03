/**
 * Verification Configuration Management
 * -----------------------------------
 * Handles verification system configuration with legacy JSON support
 */

import fs from 'fs';
import { VerificationConfigModel } from '../../database/models/verification';
import { logWithEmoji } from '../../utils';

//=============================================================================
// LEGACY SUPPORT
//=============================================================================

// Legacy configuration interface
interface LegacyVerificationConfig {
  MOD_CHANNEL_ID?: string;
  AGE_UNVERIFIED_ROLE_ID?: string;
}

// Legacy file path
const LEGACY_CONFIG_FILE = './verification_config.json';

// Global variables for legacy support
let MOD_CHANNEL_ID: string | undefined;
let AGE_UNVERIFIED_ROLE_ID: string | undefined;

//=============================================================================
// CONFIGURATION LOADING
//=============================================================================

/**
 * Load verification config from legacy JSON file
 */
export function loadVerificationConfig(): void {
  try {
    if (fs.existsSync(LEGACY_CONFIG_FILE)) {
      const configData = JSON.parse(fs.readFileSync(LEGACY_CONFIG_FILE, 'utf8')) as LegacyVerificationConfig;
      
      if (configData.MOD_CHANNEL_ID) {
        MOD_CHANNEL_ID = configData.MOD_CHANNEL_ID;
        logWithEmoji('info', `Loaded verification channel ID: ${MOD_CHANNEL_ID}`, 'Verification');
      }
      
      if (configData.AGE_UNVERIFIED_ROLE_ID) {
        AGE_UNVERIFIED_ROLE_ID = configData.AGE_UNVERIFIED_ROLE_ID;
        logWithEmoji('info', `Loaded Age Unverified role ID: ${AGE_UNVERIFIED_ROLE_ID}`, 'Verification');
      }
    } else {
      logWithEmoji('warn', 'No legacy verification config found', 'Verification');
    }
  } catch (error) {
    logWithEmoji('error', `Error loading verification config: ${error}`, 'Verification');
  }
}

/**
 * Save verification config to legacy JSON file
 */
function saveVerificationConfig(channelId: string, unverifiedRoleId?: string): void {
  try {
    // Load existing config first
    let configData: LegacyVerificationConfig = {};
    if (fs.existsSync(LEGACY_CONFIG_FILE)) {
      configData = JSON.parse(fs.readFileSync(LEGACY_CONFIG_FILE, 'utf8'));
    }
    
    // Update values
    configData.MOD_CHANNEL_ID = channelId;
    MOD_CHANNEL_ID = channelId;
    
    // Only update unverified role ID if provided
    if (unverifiedRoleId) {
      configData.AGE_UNVERIFIED_ROLE_ID = unverifiedRoleId;
      AGE_UNVERIFIED_ROLE_ID = unverifiedRoleId;
    }
    
    fs.writeFileSync(LEGACY_CONFIG_FILE, JSON.stringify(configData, null, 2));
    logWithEmoji('success', 'Verification config saved to legacy file', 'Verification');
  } catch (error) {
    logWithEmoji('error', `Error saving verification config: ${error}`, 'Verification');
    throw error;
  }
}

//=============================================================================
// DATABASE INTEGRATION
//=============================================================================

/**
 * Initialize verification configuration from legacy data
 */
export async function initializeVerificationConfig(): Promise<void> {
  try {
    // If we have legacy config and environment guild ID, migrate to database
    const guildId = process.env.GUILD_ID || process.env.SERVER_ID;
    
    if (guildId && (MOD_CHANNEL_ID || AGE_UNVERIFIED_ROLE_ID)) {
      logWithEmoji('info', 'Migrating legacy verification config to database...', 'Verification');
      
      // Check if config already exists in database
      let config = await VerificationConfigModel.getByGuildId(guildId);
      
      if (!config) {
        // Create new config with legacy data
        await VerificationConfigModel.upsert({
          guild_id: guildId,
          mod_channel_id: MOD_CHANNEL_ID,
          age_unverified_role_id: AGE_UNVERIFIED_ROLE_ID,
          enabled: true
        });
        
        logWithEmoji('success', 'Legacy verification config migrated to database', 'Verification');
      } else {
        // Update existing config with legacy data if fields are missing
        const updates: any = {};
        
        if (!config.mod_channel_id && MOD_CHANNEL_ID) {
          updates.mod_channel_id = MOD_CHANNEL_ID;
        }
        
        if (!config.age_unverified_role_id && AGE_UNVERIFIED_ROLE_ID) {
          updates.age_unverified_role_id = AGE_UNVERIFIED_ROLE_ID;
        }
        
        if (Object.keys(updates).length > 0) {
          await VerificationConfigModel.upsert({
            guild_id: guildId,
            ...updates
          });
          
          logWithEmoji('success', 'Updated verification config with legacy data', 'Verification');
        }
      }
    }
  } catch (error) {
    logWithEmoji('error', `Error initializing verification config: ${error}`, 'Verification');
  }
}

//=============================================================================
// CONFIGURATION MANAGEMENT
//=============================================================================

/**
 * Set verification channel for a guild
 */
export async function setVerificationChannel(guildId: string, channelId: string): Promise<void> {
  try {
    // Update database
    await VerificationConfigModel.setModChannel(guildId, channelId);
    
    // Update legacy file for backward compatibility
    saveVerificationConfig(channelId, AGE_UNVERIFIED_ROLE_ID);
    
    // Update global variable
    MOD_CHANNEL_ID = channelId;
    
    logWithEmoji('success', `Verification channel set to ${channelId}`, 'Verification');
  } catch (error) {
    logWithEmoji('error', `Error setting verification channel: ${error}`, 'Verification');
    throw error;
  }
}

/**
 * Set age unverified role for a guild
 */
export async function setAgeUnverifiedRole(guildId: string, roleId: string): Promise<void> {
  try {
    // Update database
    await VerificationConfigModel.setAgeUnverifiedRole(guildId, roleId);
    
    // Update legacy file for backward compatibility
    saveVerificationConfig(MOD_CHANNEL_ID || '', roleId);
    
    // Update global variable
    AGE_UNVERIFIED_ROLE_ID = roleId;
    
    logWithEmoji('success', `Age unverified role set to ${roleId}`, 'Verification');
  } catch (error) {
    logWithEmoji('error', `Error setting age unverified role: ${error}`, 'Verification');
    throw error;
  }
}

/**
 * Get verification configuration for a guild
 */
export async function getVerificationConfig(guildId: string): Promise<any> {
  try {
    const config = await VerificationConfigModel.getByGuildId(guildId);
    
    // Fall back to legacy config if database config doesn't exist
    if (!config && (MOD_CHANNEL_ID || AGE_UNVERIFIED_ROLE_ID)) {
      return {
        guild_id: guildId,
        mod_channel_id: MOD_CHANNEL_ID,
        age_unverified_role_id: AGE_UNVERIFIED_ROLE_ID,
        enabled: true
      };
    }
    
    return config;
  } catch (error) {
    logWithEmoji('error', `Error getting verification config: ${error}`, 'Verification');
    return null;
  }
}

//=============================================================================
// LEGACY GETTERS (for backward compatibility)
//=============================================================================

/**
 * Get the age unverified role ID (legacy support)
 */
export function getAgeUnverifiedRoleId(): string | undefined {
  return AGE_UNVERIFIED_ROLE_ID;
}

/**
 * Get the mod channel ID (legacy support)
 */
export function getModChannelId(): string | undefined {
  return MOD_CHANNEL_ID;
}

//=============================================================================
// EXPORTS
//=============================================================================

export {
  MOD_CHANNEL_ID,
  AGE_UNVERIFIED_ROLE_ID
};
