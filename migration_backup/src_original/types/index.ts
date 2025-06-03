/**
 * Type Definitions for The Roommates Helper
 * ----------------------------------------
 * Central location for all TypeScript type definitions used throughout the bot.
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';

//=============================================================================
// COMMAND TYPES
//=============================================================================

/**
 * Base interface for all bot commands
 */
export interface BotCommand {
  /** The slash command data for Discord API registration */
  data: SlashCommandBuilder;
  /** The function to execute when the command is called */
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  /** Optional cooldown in milliseconds */
  cooldown?: number;
  /** Whether this command requires specific permissions */
  permissions?: bigint[];
}

/**
 * Command category for organizing commands
 */
export interface CommandCategory {
  /** Category name */
  name: string;
  /** Category description */
  description: string;
  /** Commands in this category */
  commands: BotCommand[];
  /** Whether this category is for admin commands only */
  adminOnly?: boolean;
}

//=============================================================================
// SYSTEM TYPES
//=============================================================================

/**
 * Bot system interface - all systems should implement this
 */
export interface BotSystem {
  /** System name for logging */
  name: string;
  /** Setup function called during bot initialization */
  setup: (client: Client) => Promise<void> | void;
  /** Cleanup function called during bot shutdown */
  cleanup?: () => Promise<void> | void;
  /** Whether this system is enabled */
  enabled: boolean;
}

/**
 * Configuration interface for systems that need configuration
 */
export interface SystemConfig {
  /** Whether the system is enabled */
  enabled: boolean;
  /** Guild ID this config applies to */
  guildId: string;
  /** Timestamp when config was last updated */
  updatedAt: number;
}

//=============================================================================
// DATABASE TYPES
//=============================================================================

/**
 * Base interface for database models
 */
export interface DatabaseModel {
  /** Unique identifier */
  id: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Guild configuration interface
 */
export interface GuildConfig extends DatabaseModel {
  /** Discord guild ID */
  guildId: string;
  /** Guild name */
  name: string;
  /** Whether the bot is active in this guild */
  active: boolean;
  /** Guild-specific settings */
  settings: Record<string, any>;
}

//=============================================================================
// COLOR ROLE TYPES
//=============================================================================

/**
 * Color role definition
 */
export interface ColorRole {
  /** Role ID */
  id: string;
  /** Role name */
  name: string;
  /** Hex color code */
  hexColor: string;
  /** Category this role belongs to */
  category?: string;
}

/**
 * Color categories for organizing roles
 */
export interface ColorCategory {
  /** Category name */
  name: string;
  /** Roles in this category */
  roles: ColorRole[];
}

//=============================================================================
// LOGGING TYPES
//=============================================================================

/**
 * Log levels for the Discord logger
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

/**
 * Log message structure
 */
export interface LogMessage {
  /** Log level */
  level: LogLevel;
  /** Log message content */
  message: string;
  /** Timestamp when log was created */
  timestamp?: Date;
  /** Source of the log (e.g., 'Bot', 'Commands', 'Database') */
  source?: string;
  /** Additional details */
  details?: any;
}

//=============================================================================
// EVENT TYPES
//=============================================================================

/**
 * Custom bot events
 */
export interface BotEvents {
  /** Emitted when a command is executed */
  commandExecuted: (commandName: string, userId: string, guildId?: string) => void;
  /** Emitted when a system is loaded */
  systemLoaded: (systemName: string) => void;
  /** Emitted when an error occurs */
  botError: (error: Error, context: string) => void;
}

//=============================================================================
// UTILITY TYPES
//=============================================================================

/**
 * Duration type for time-based operations
 */
export interface Duration {
  /** Duration in milliseconds */
  milliseconds: number;
  /** Human-readable string representation */
  humanReadable: string;
}

/**
 * Embed field type for consistent embed creation
 */
export interface EmbedField {
  /** Field name */
  name: string;
  /** Field value */
  value: string;
  /** Whether field should be inline */
  inline?: boolean;
}

/**
 * Response type for command responses
 */
export interface CommandResponse {
  /** Response content */
  content?: string;
  /** Whether response should be ephemeral */
  ephemeral?: boolean;
  /** Embed to include in response */
  embed?: any;
  /** Components to include in response */
  components?: any[];
}

//=============================================================================
// HEALTH CHECK TYPES
//=============================================================================

/**
 * Health status for monitoring
 */
export interface HealthStatus {
  /** Current status */
  status: 'online' | 'offline' | 'starting' | 'updating';
  /** Last heartbeat timestamp */
  lastHeartbeat: number;
  /** Bot start time */
  startTime: number;
  /** Uptime in seconds */
  uptime: number;
  /** Bot version */
  version?: string;
}

//=============================================================================
// EXPORT ORGANIZED TYPES
//=============================================================================

// Re-export commonly used Discord.js types for convenience
export {
  Client,
  Guild,
  GuildMember,
  User,
  TextChannel,
  VoiceChannel,
  Role,
  Message,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ModalBuilder,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  PermissionFlagsBits
} from 'discord.js';
