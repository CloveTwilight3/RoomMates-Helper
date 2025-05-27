/**
 * Warning System for The Roommates Helper
 * -----------------------------------------
 * A comprehensive warning and moderation system with escalating punishments
 * and appeal functionality.
 * 
 * Warning Tiers:
 * - 1st, 2nd, 3rd warning: Just a warning notification
 * - 4th warning: 2 hour mute
 * - 5th warning: 24 hour mute
 * - 6th warning: Ban with appeal option
 * - 7th warning: Permanent ban without appeal
 * 
 * @license MIT
 * @copyright 2025 Clove Twilight
 */

//=============================================================================
// IMPORTS
//=============================================================================

import { 
  Client, 
  TextChannel,
  User,
  GuildMember,
  PermissionFlagsBits,
  EmbedBuilder,
  SlashCommandBuilder,
  CommandInteraction,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  GuildMemberRoleManager,
  Guild,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
  DMChannel,
  MessageFlags
} from 'discord.js';
import fs from 'fs';

//=============================================================================
// TYPES AND INTERFACES
//=============================================================================

/**
 * Types of infractions
 */
export enum InfractionType {
  WARNING = 'WARNING',
  MUTE = 'MUTE',
  UNMUTE = 'UNMUTE',
  BAN = 'BAN',
  UNBAN = 'UNBAN',
  KICK = 'KICK',
  NOTE = 'NOTE'
}

/**
 * Appeal status types
 */
export enum AppealStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED'
}

/**
 * An appeal object for tracking user appeals
 */
interface Appeal {
  userId: string; // User ID
  caseId: string; // Related infraction ID
  infractionType: InfractionType; // Type of infraction being appealed
  reason: string; // User's appeal reason
  status: AppealStatus; // Current status
  timestamp: number; // When appeal was submitted
  reviewerId?: string; // Moderator who reviewed the appeal
  reviewReason?: string; // Moderator's comments on review
  reviewTimestamp?: number; // When the appeal was reviewed
}

/**
 * An infraction record
 */
interface Infraction {
  id: string; // Unique ID for this infraction
  userId: string; // User ID
  guildId: string; // Guild ID
  moderatorId: string; // ID of moderator who issued the infraction
  type: InfractionType; // Type of infraction
  reason: string; // Reason for the infraction
  timestamp: number; // When the infraction was issued
  expiresAt?: number; // When mute/ban expires (if temporary)
  active: boolean; // Whether this is still active
  appealed?: boolean; // Whether this has been appealed
  appealId?: string; // ID of related appeal
}

/**
 * Database of infractions per guild
 */
interface InfractionDatabase {
  [guildId: string]: {
    infractions: Infraction[];
    appeals: Appeal[];
    config: ModConfig;
  }
}

/**
 * Configuration for the moderation system
 */
interface ModConfig {
  enabled: boolean;
  moderatorRoleId?: string;
  mutedRoleId?: string;
  logChannelId?: string;
  appealChannelId?: string;
  dmNotifications: boolean;
  autoDelete: boolean;
  deleteDelay: number;
  warnThreshold: number; // Warnings before first escalation
  allowAppeals: boolean;
  appealCooldown: number; // Hours between appeal attempts
}

// Default configuration
const defaultConfig: ModConfig = {
  enabled: false,
  dmNotifications: true,
  autoDelete: true,
  deleteDelay: 5000, // 5 seconds
  warnThreshold: 3, // 3 warnings before escalation
  allowAppeals: true,
  appealCooldown: 24 // 24 hours
};

//=============================================================================
// CONSTANTS
//=============================================================================

// File path for the infraction database
const INFRACTIONS_FILE = 'infractions.json';

// Punishment tiers
const PUNISHMENT_TIERS = [
  { tier: 4, type: InfractionType.MUTE, duration: 2 * 60 * 60 * 1000 }, // 2 hours in ms
  { tier: 5, type: InfractionType.MUTE, duration: 24 * 60 * 60 * 1000 }, // 24 hours in ms
  { tier: 6, type: InfractionType.BAN, duration: 0, allowAppeal: true }, // Permanent ban with appeal
  { tier: 7, type: InfractionType.BAN, duration: 0, allowAppeal: false } // Permanent ban without appeal
];

//=============================================================================
// STATE MANAGEMENT
//=============================================================================

// In-memory database
let infractionDB: InfractionDatabase = {};

// Active timers for mute expirations
const muteTimers: Map<string, NodeJS.Timeout> = new Map();

//=============================================================================
// DATABASE FUNCTIONS
//=============================================================================

/**
 * Load the infraction database from disk
 */
function loadInfractionDatabase(): void {
  try {
    if (fs.existsSync(INFRACTIONS_FILE)) {
      const data = fs.readFileSync(INFRACTIONS_FILE, 'utf8');
      infractionDB = JSON.parse(data);
      console.log('Infraction database loaded successfully');
      
      // Ensure each guild has a config object
      Object.keys(infractionDB).forEach(guildId => {
        if (!infractionDB[guildId].config) {
          infractionDB[guildId].config = { ...defaultConfig };
        } else {
          // Merge with defaults for any missing properties
          infractionDB[guildId].config = { 
            ...defaultConfig, 
            ...infractionDB[guildId].config 
          };
        }
      });
    } else {
      console.log('No infraction database found, starting with empty database');
    }
  } catch (error) {
    console.error('Error loading infraction database:', error);
    infractionDB = {};
  }
}

/**
 * Save the infraction database to disk
 */
function saveInfractionDatabase(): void {
  try {
    fs.writeFileSync(INFRACTIONS_FILE, JSON.stringify(infractionDB, null, 2));
    console.log('Infraction database saved successfully');
  } catch (error) {
    console.error('Error saving infraction database:', error);
  }
}

/**
 * Initialize a guild in the database if it doesn't exist
 * @param guildId The guild ID to initialize
 */
function initGuildIfNeeded(guildId: string): void {
  if (!infractionDB[guildId]) {
    infractionDB[guildId] = {
      infractions: [],
      appeals: [],
      config: { ...defaultConfig }
    };
    saveInfractionDatabase();
  }
}

/**
 * Get the configuration for a guild
 * @param guildId The guild ID
 * @returns The guild's configuration or the default config
 */
function getGuildConfig(guildId: string): ModConfig {
  initGuildIfNeeded(guildId);
  return infractionDB[guildId].config;
}

/**
 * Update the configuration for a guild
 * @param guildId The guild ID
 * @param config The new configuration
 */
function updateGuildConfig(guildId: string, config: Partial<ModConfig>): void {
  initGuildIfNeeded(guildId);
  infractionDB[guildId].config = {
    ...infractionDB[guildId].config,
    ...config
  };
  saveInfractionDatabase();
}

/**
 * Add an infraction to the database
 * @param infraction The infraction to add
 */
function addInfraction(infraction: Infraction): void {
  initGuildIfNeeded(infraction.guildId);
  infractionDB[infraction.guildId].infractions.push(infraction);
  saveInfractionDatabase();
}

/**
 * Get all infractions for a user in a guild
 * @param guildId The guild ID
 * @param userId The user ID
 * @returns Array of infractions
 */
function getUserInfractions(guildId: string, userId: string): Infraction[] {
  initGuildIfNeeded(guildId);
  return infractionDB[guildId].infractions.filter(
    infraction => infraction.userId === userId
  );
}

/**
 * Get active infractions for a user in a guild
 * @param guildId The guild ID
 * @param userId The user ID
 * @returns Array of active infractions
 */
function getActiveInfractions(guildId: string, userId: string): Infraction[] {
  return getUserInfractions(guildId, userId).filter(
    infraction => infraction.active
  );
}

/**
 * Get all warnings for a user in a guild
 * @param guildId The guild ID
 * @param userId The user ID
 * @returns Array of warnings
 */
function getUserWarnings(guildId: string, userId: string): Infraction[] {
  return getUserInfractions(guildId, userId).filter(
    infraction => infraction.type === InfractionType.WARNING
  );
}

/**
 * Get active warnings for a user in a guild
 * @param guildId The guild ID
 * @param userId The user ID
 * @returns Array of active warnings
 */
function getActiveWarnings(guildId: string, userId: string): Infraction[] {
  return getUserWarnings(guildId, userId).filter(
    infraction => infraction.active
  );
}

/**
 * Get a specific infraction by ID
 * @param guildId The guild ID
 * @param infractionId The infraction ID
 * @returns The infraction or undefined
 */
function getInfraction(guildId: string, infractionId: string): Infraction | undefined {
  initGuildIfNeeded(guildId);
  return infractionDB[guildId].infractions.find(
    infraction => infraction.id === infractionId
  );
}

/**
 * Update an infraction in the database
 * @param guildId The guild ID
 * @param infractionId The infraction ID
 * @param updates The updates to apply
 * @returns Whether the update was successful
 */
function updateInfraction(
  guildId: string, 
  infractionId: string, 
  updates: Partial<Infraction>
): boolean {
  initGuildIfNeeded(guildId);
  
  const index = infractionDB[guildId].infractions.findIndex(
    infraction => infraction.id === infractionId
  );
  
  if (index === -1) return false;
  
  infractionDB[guildId].infractions[index] = {
    ...infractionDB[guildId].infractions[index],
    ...updates
  };
  
  saveInfractionDatabase();
  return true;
}

/**
 * Add an appeal to the database
 * @param appeal The appeal to add
 */
function addAppeal(appeal: Appeal): void {
  const guildId = getGuildIdFromCaseId(appeal.caseId);
  if (!guildId) return;
  
  initGuildIfNeeded(guildId);
  infractionDB[guildId].appeals.push(appeal);
  
  // Update the infraction to mark as appealed
  const infraction = getInfraction(guildId, appeal.caseId);
  if (infraction) {
    updateInfraction(guildId, appeal.caseId, { 
      appealed: true,
      appealId: appeal.caseId + '_appeal'
    });
  }
  
  saveInfractionDatabase();
}

/**
 * Get an appeal by case ID
 * @param guildId The guild ID
 * @param caseId The case ID
 * @returns The appeal or undefined
 */
function getAppeal(guildId: string, caseId: string): Appeal | undefined {
  initGuildIfNeeded(guildId);
  return infractionDB[guildId].appeals.find(
    appeal => appeal.caseId === caseId
  );
}

/**
 * Update an appeal in the database
 * @param guildId The guild ID
 * @param caseId The case ID
 * @param updates The updates to apply
 * @returns Whether the update was successful
 */
function updateAppeal(
  guildId: string, 
  caseId: string, 
  updates: Partial<Appeal>
): boolean {
  initGuildIfNeeded(guildId);
  
  const index = infractionDB[guildId].appeals.findIndex(
    appeal => appeal.caseId === caseId
  );
  
  if (index === -1) return false;
  
  infractionDB[guildId].appeals[index] = {
    ...infractionDB[guildId].appeals[index],
    ...updates
  };
  
  saveInfractionDatabase();
  return true;
}

/**
 * Get all appeals for a user in a guild
 * @param guildId The guild ID
 * @param userId The user ID
 * @returns Array of appeals
 */
function getUserAppeals(guildId: string, userId: string): Appeal[] {
  initGuildIfNeeded(guildId);
  return infractionDB[guildId].appeals.filter(
    appeal => appeal.userId === userId
  );
}

/**
 * Get the guild ID from a case ID
 * This assumes case IDs are formatted as `guildId-timestamp-random`
 * @param caseId The case ID
 * @returns The guild ID or undefined
 */
function getGuildIdFromCaseId(caseId: string): string | undefined {
  const parts = caseId.split('-');
  if (parts.length >= 1) {
    return parts[0];
  }
  return undefined;
}

/**
 * Generate a unique case ID
 * @param guildId The guild ID
 * @returns A unique case ID
 */
function generateCaseId(guildId: string): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${guildId}-${timestamp}-${random}`;
}

//=============================================================================
// COMMAND REGISTRATION
//=============================================================================

/**
 * Register warning system commands
 * @param commandsArray Array to add the commands to
 */
export function registerModCommands(commandsArray: any[]): void {
  // Warn command
  const warnCommand = new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a warning to a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => 
      option
        .setName('user')
        .setDescription('The user to warn')
        .setRequired(true)
    )
    .addStringOption(option => 
      option
        .setName('reason')
        .setDescription('The reason for the warning')
        .setRequired(true)
    )
    .addBooleanOption(option => 
      option
        .setName('silent')
        .setDescription('Whether to send the warning privately (default: false)')
        .setRequired(false)
    )
    .toJSON();
  
  // Warnings command
  const warningsCommand = new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View warnings for a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => 
      option
        .setName('user')
        .setDescription('The user to check warnings for')
        .setRequired(true)
    )
    .toJSON();
  
  // Clear warnings command
  const clearWarningsCommand = new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Clear warnings for a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => 
      option
        .setName('user')
        .setDescription('The user to clear warnings for')
        .setRequired(true)
    )
    .addStringOption(option => 
      option
        .setName('reason')
        .setDescription('The reason for clearing warnings')
        .setRequired(true)
    )
    .toJSON();
  
  // Mute command
  const muteCommand = new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a user for a specified duration')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => 
      option
        .setName('user')
        .setDescription('The user to mute')
        .setRequired(true)
    )
    .addStringOption(option => 
      option
        .setName('duration')
        .setDescription('Duration (e.g., 1h, 30m, 1d)')
        .setRequired(true)
    )
    .addStringOption(option => 
      option
        .setName('reason')
        .setDescription('The reason for the mute')
        .setRequired(true)
    )
    .toJSON();
  
  // Unmute command
  const unmuteCommand = new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmute a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => 
      option
        .setName('user')
        .setDescription('The user to unmute')
        .setRequired(true)
    )
    .addStringOption(option => 
      option
        .setName('reason')
        .setDescription('The reason for the unmute')
        .setRequired(true)
    )
    .toJSON();
    
  // Ban command
  const banCommand = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(option => 
      option
        .setName('user')
        .setDescription('The user to ban')
        .setRequired(true)
    )
    .addStringOption(option => 
      option
        .setName('reason')
        .setDescription('The reason for the ban')
        .setRequired(true)
    )
    .addBooleanOption(option => 
      option
        .setName('allow_appeal')
        .setDescription('Whether the user can appeal this ban')
        .setRequired(false)
    )
    .addIntegerOption(option => 
      option
        .setName('delete_days')
        .setDescription('Number of days of messages to delete')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(7)
    )
    .toJSON();
  
  // Unban command
  const unbanCommand = new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(option => 
      option
        .setName('userid')
        .setDescription('The ID of the user to unban')
        .setRequired(true)
    )
    .addStringOption(option => 
      option
        .setName('reason')
        .setDescription('The reason for the unban')
        .setRequired(true)
    )
    .toJSON();
  
  // Kick command
  const kickCommand = new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(option => 
      option
        .setName('user')
        .setDescription('The user to kick')
        .setRequired(true)
    )
    .addStringOption(option => 
      option
        .setName('reason')
        .setDescription('The reason for the kick')
        .setRequired(true)
    )
    .toJSON();
  
  // Note command
  const noteCommand = new SlashCommandBuilder()
    .setName('note')
    .setDescription('Add a note to a user\'s record (not visible to the user)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => 
      option
        .setName('user')
        .setDescription('The user to add a note for')
        .setRequired(true)
    )
    .addStringOption(option => 
      option
        .setName('content')
        .setDescription('The note content')
        .setRequired(true)
    )
    .toJSON();
  
  // Modconfig command
  const modConfigCommand = new SlashCommandBuilder()
    .setName('modconfig')
    .setDescription('Configure the moderation system')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand => 
      subcommand
        .setName('status')
        .setDescription('Show current configuration')
    )
    .addSubcommand(subcommand => 
      subcommand
        .setName('enable')
        .setDescription('Enable the moderation system')
    )
    .addSubcommand(subcommand => 
      subcommand
        .setName('disable')
        .setDescription('Disable the moderation system')
    )
    .addSubcommand(subcommand => 
      subcommand
        .setName('mutedrole')
        .setDescription('Set the muted role')
        .addRoleOption(option => 
          option
            .setName('role')
            .setDescription('The role to use for muted users')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand => 
      subcommand
        .setName('modrole')
        .setDescription('Set the moderator role')
        .addRoleOption(option => 
          option
            .setName('role')
            .setDescription('The role to use for moderators')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand => 
      subcommand
        .setName('logchannel')
        .setDescription('Set the log channel')
        .addChannelOption(option => 
          option
            .setName('channel')
            .setDescription('The channel to use for moderation logs')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand => 
      subcommand
        .setName('appealchannel')
        .setDescription('Set the appeal channel')
        .addChannelOption(option => 
          option
            .setName('channel')
            .setDescription('The channel to use for ban appeals')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand => 
      subcommand
        .setName('dmnotifications')
        .setDescription('Toggle DM notifications')
        .addBooleanOption(option => 
          option
            .setName('enabled')
            .setDescription('Whether to send DM notifications to users')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand => 
      subcommand
        .setName('threshold')
        .setDescription('Set warning threshold before punishment')
        .addIntegerOption(option => 
          option
            .setName('count')
            .setDescription('Number of warnings before escalation (default: 3)')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand => 
      subcommand
        .setName('appeals')
        .setDescription('Toggle whether appeals are allowed')
        .addBooleanOption(option => 
          option
            .setName('enabled')
            .setDescription('Whether users can appeal bans and mutes')
            .setRequired(true)
        )
    )
    .toJSON();
    
  // Appeal command
  const appealCommand = new SlashCommandBuilder()
    .setName('appeal')
    .setDescription('Appeal a punishment')
    .addStringOption(option => 
      option
        .setName('type')
        .setDescription('The type of punishment to appeal')
        .setRequired(true)
        .addChoices(
          { name: 'Warning', value: 'WARNING' },
          { name: 'Mute', value: 'MUTE' },
          { name: 'Ban', value: 'BAN' }
        )
    )
    .toJSON();
    
  // Check command
  const checkCommand = new SlashCommandBuilder()
    .setName('check')
    .setDescription('Check a user\'s moderation history')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => 
      option
        .setName('user')
        .setDescription('The user to check')
        .setRequired(true)
    )
    .toJSON();
    
  // Echo command
  const echoCommand = new SlashCommandBuilder()
    .setName('echo')
    .setDescription('Make the bot send a message')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addStringOption(option => 
      option
        .setName('message')
        .setDescription('The message to send')
        .setRequired(true)
        .setMaxLength(2000)
    )
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('The channel to send the message to (defaults to current channel)')
        .setRequired(false)
    )
    .toJSON();
    
  // Add all commands to the array
  commandsArray.push(
    warnCommand,
    warningsCommand,
    clearWarningsCommand,
    muteCommand,
    unmuteCommand,
    banCommand,
    unbanCommand,
    kickCommand,
    noteCommand,
    modConfigCommand,
    appealCommand,
    checkCommand,
    echoCommand
  );
}

//=============================================================================
// SYSTEM SETUP
//=============================================================================

/**
 * Set up the warning system
 * @param client Discord.js client
 */
export function setupWarningSystem(client: Client): void {
  console.log('Setting up warning system...');
  
  // Load the database
  loadInfractionDatabase();
  
  // Schedule unmutes for existing temporary mutes
  restoreTemporaryMutes(client);
  
  console.log('Warning system setup complete');
}

/**
 * Restore any active temporary mutes when the bot restarts
 * @param client Discord.js client
 */
async function restoreTemporaryMutes(client: Client): Promise<void> {
  console.log('Restoring temporary mutes...');
  
  try {
    // Get all guilds in the database
    const guildIds = Object.keys(infractionDB);
    
    for (const guildId of guildIds) {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) continue;
      
      const config = getGuildConfig(guildId);
      if (!config.mutedRoleId) continue;
      
      // Find all active mutes
      const activeMutes = infractionDB[guildId].infractions.filter(
        infraction => 
          infraction.type === InfractionType.MUTE && 
          infraction.active && 
          infraction.expiresAt && 
          infraction.expiresAt > Date.now()
      );
      
      console.log(`Found ${activeMutes.length} active mutes in ${guild.name}`);
      
      // Schedule unmutes for each
      for (const mute of activeMutes) {
        const timeLeft = mute.expiresAt! - Date.now();
        
        if (timeLeft <= 0) {
          // Mute has already expired, unmute immediately
          await unmuteUser(client, guild, mute.userId, 'Mute expired', 'System');
        } else {
          // Schedule unmute
          console.log(`Scheduling unmute for ${mute.userId} in ${guild.name} in ${Math.floor(timeLeft / 1000)} seconds`);
          
          const timer = setTimeout(async () => {
            await unmuteUser(client, guild, mute.userId, 'Mute expired', 'System');
          }, timeLeft);
          
          // Store the timer
          muteTimers.set(`${guildId}-${mute.userId}`, timer);
        }
      }
    }
  } catch (error) {
    console.error('Error restoring temporary mutes:', error);
  }
}

//=============================================================================
// COMMAND HANDLERS
//=============================================================================

/**
 * Main handler for mod commands
 * @param interaction Command interaction
 */
export async function handleModCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    // Allow the command to be used in DMs for banned users
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
  }
  
  const guildId = interaction.guild?.id || interaction.guildId!;
  const config = getGuildConfig(guildId);
  
  // Handle commands that work even when the system is disabled
  if (interaction.commandName === 'modconfig') {
    await handleModConfigCommand(interaction);
    return;
  }
  
  // Check if the warning system is enabled
  if (!config.enabled && interaction.commandName !== 'appeal') {
    await interaction.reply({
      content: 'The moderation system is not enabled in this server. An administrator can enable it with `/modconfig enable`.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Handle the specific command
  try {
    switch (interaction.commandName) {
      case 'warn':
        await handleWarnCommand(interaction);
        break;
      
      case 'warnings':
        await handleWarningsCommand(interaction);
        break;
      
      case 'clearwarnings':
        await handleClearWarningsCommand(interaction);
        break;
      
      case 'mute':
        await handleMuteCommand(interaction);
        break;
      
      case 'unmute':
        await handleUnmuteCommand(interaction);
        break;
      
      case 'ban':
        await handleBanCommand(interaction);
        break;
      
      case 'unban':
        await handleUnbanCommand(interaction);
        break;
      
      case 'kick':
        await handleKickCommand(interaction);
        break;
      
      case 'note':
        await handleNoteCommand(interaction);
        break;
      
      case 'appeal':
        await handleAppealCommand(interaction);
        break;
      
      case 'check':
        await handleCheckCommand(interaction);
        break;
      
      case 'echo':
        await handleEchoCommand(interaction);
        break;
      
      default:
        await interaction.reply({
          content: 'Unknown command.',
          flags: MessageFlags.Ephemeral
        });
    }
  } catch (error) {
    console.error(`Error handling mod command ${interaction.commandName}:`, error);
    
    // Only reply if we haven't already
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'An error occurred while processing this command. Please try again later.',
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
  }
}

/**
 * Handle the echo command
 * @param interaction Command interaction
 */
async function handleEchoCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  
  const guildId = interaction.guild.id;
  const config = getGuildConfig(guildId);
  
  // Get command options
  const message = interaction.options.getString('message');
  const targetChannelOption = interaction.options.getChannel('channel');
  
  if (!message) {
    await interaction.reply({
      content: 'Please provide a message to send.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Determine which channel to send to
  let channelToSendTo: TextChannel;
  
  if (targetChannelOption) {
    // Validate that the target channel is a text channel
    if (targetChannelOption.type !== 0) { // 0 is GUILD_TEXT
      await interaction.reply({
        content: 'Please select a valid text channel.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    try {
      // Fetch the actual channel object from the guild
      const fetchedChannel = await interaction.guild.channels.fetch(targetChannelOption.id);
      if (!fetchedChannel || !fetchedChannel.isTextBased()) {
        await interaction.reply({
          content: 'Could not access the specified channel or it is not a text channel.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
      // Check if the bot has permission to send messages in the target channel
      const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
      if (!botMember) {
        await interaction.reply({
          content: 'Could not verify bot permissions.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
      const permissions = fetchedChannel.permissionsFor(botMember);
      if (!permissions || !permissions.has(PermissionFlagsBits.SendMessages)) {
        await interaction.reply({
          content: `I don't have permission to send messages in ${fetchedChannel.toString()}.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
      channelToSendTo = fetchedChannel as TextChannel;
    } catch (error) {
      console.error('Error fetching target channel:', error);
      await interaction.reply({
        content: 'Could not access the specified channel.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
  } else {
    // Use current channel
    if (!interaction.channel || !interaction.channel.isTextBased()) {
      await interaction.reply({
        content: 'Could not determine a valid channel to send the message to.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    channelToSendTo = interaction.channel as TextChannel;
  }
  
  try {
    // Send the message
    await channelToSendTo.send(message);
    
    // Log the echo command usage
    if (config.logChannelId) {
      try {
        const logChannel = await interaction.guild.channels.fetch(config.logChannelId);
        if (logChannel && logChannel.isTextBased()) {
          const logEmbed = new EmbedBuilder()
            .setTitle('Echo Command Used')
            .setColor(0x5865F2)
            .setDescription(`**Moderator:** ${interaction.user.toString()} (${interaction.user.tag})`)
            .addFields(
              { name: 'Channel', value: channelToSendTo.toString() },
              { name: 'Message', value: message.length > 1000 ? message.substring(0, 1000) + '...' : message }
            )
            .setTimestamp();
          
          await (logChannel as TextChannel).send({ embeds: [logEmbed] });
        }
      } catch (logError) {
        console.error('Error logging echo command:', logError);
      }
    }
    
    // Confirm to the moderator
    const confirmMessage = targetChannelOption 
      ? `Message sent to ${channelToSendTo.toString()}.`
      : 'Message sent to this channel.';
    
    await interaction.reply({
      content: confirmMessage,
      flags: MessageFlags.Ephemeral
    });
    
  } catch (error) {
    console.error('Error sending echo message:', error);
    await interaction.reply({
      content: 'There was an error sending the message. Please check my permissions.',
      flags: MessageFlags.Ephemeral
    });
  }
}

/**
 * Handle modconfig command
 * @param interaction Command interaction
 */
async function handleModConfigCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  
  const guildId = interaction.guild.id;
  const subcommand = interaction.options.getSubcommand();
  
  switch (subcommand) {
    case 'status':
      await showModConfigStatus(interaction, guildId);
      break;
    
    case 'enable':
      await enableModSystem(interaction, guildId);
      break;
    
    case 'disable':
      await disableModSystem(interaction, guildId);
      break;
    
    case 'mutedrole':
      await setMutedRole(interaction, guildId);
      break;
    
    case 'modrole':
      await setModRole(interaction, guildId);
      break;
    
    case 'logchannel':
      await setLogChannel(interaction, guildId);
      break;
    
    case 'appealchannel':
      await setAppealChannel(interaction, guildId);
      break;
    
    case 'dmnotifications':
      await setDmNotifications(interaction, guildId);
      break;
    
    case 'threshold':
      await setWarnThreshold(interaction, guildId);
      break;
    
    case 'appeals':
      await setAppealsEnabled(interaction, guildId);
      break;
    
    default:
      await interaction.reply({
        content: 'Unknown subcommand.',
        ephemeral: true
      });
  }
}

/**
 * Show the current mod config status
 * @param interaction Command interaction
 * @param guildId The guild ID
 */
async function showModConfigStatus(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const config = getGuildConfig(guildId);
  
  const embed = new EmbedBuilder()
    .setTitle('Moderation System Configuration')
    .setColor(config.enabled ? 0x00FF00 : 0xFF0000)
    .setDescription(`The moderation system is currently **${config.enabled ? 'enabled' : 'disabled'}**.`)
    .addFields(
      { 
        name: 'Roles', 
        value: `Moderator Role: ${config.moderatorRoleId ? `<@&${config.moderatorRoleId}>` : 'Not set'}\nMuted Role: ${config.mutedRoleId ? `<@&${config.mutedRoleId}>` : 'Not set'}`
      },
      {
        name: 'Channels',
        value: `Log Channel: ${config.logChannelId ? `<#${config.logChannelId}>` : 'Not set'}\nAppeal Channel: ${config.appealChannelId ? `<#${config.appealChannelId}>` : 'Not set'}`
      },
      {
        name: 'Settings',
        value: `DM Notifications: ${config.dmNotifications ? 'Enabled' : 'Disabled'}\nWarning Threshold: ${config.warnThreshold}\nAppeals: ${config.allowAppeals ? 'Allowed' : 'Disabled'}\nAppeal Cooldown: ${config.appealCooldown} hours`
      }
    )
    .setTimestamp();
  
  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral
  });
}

/**
 * Enable the mod system
 * @param interaction Command interaction
 * @param guildId The guild ID
 */
async function enableModSystem(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  updateGuildConfig(guildId, { enabled: true });
  
  await interaction.reply({
    content: 'The moderation system has been enabled.',
    flags: MessageFlags.Ephemeral
  });
}

/**
 * Disable the mod system
 * @param interaction Command interaction
 * @param guildId The guild ID
 */
async function disableModSystem(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  updateGuildConfig(guildId, { enabled: false });
  
  await interaction.reply({
    content: 'The moderation system has been disabled.',
    flags: MessageFlags.Ephemeral
  });
}

/**
 * Set the muted role
 * @param interaction Command interaction
 * @param guildId The guild ID
 */
async function setMutedRole(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const role = interaction.options.getRole('role');
  if (!role) {
    await interaction.reply({
      content: 'Please provide a valid role.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  updateGuildConfig(guildId, { mutedRoleId: role.id });
  
  await interaction.reply({
    content: `The muted role has been set to ${role.toString()}.`,
    flags: MessageFlags.Ephemeral
  });
}

/**
 * Set the moderator role
 * @param interaction Command interaction
 * @param guildId The guild ID
 */
async function setModRole(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const role = interaction.options.getRole('role');
  if (!role) {
    await interaction.reply({
      content: 'Please provide a valid role.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  updateGuildConfig(guildId, { moderatorRoleId: role.id });
  
  await interaction.reply({
    content: `The moderator role has been set to ${role.toString()}.`,
    flags: MessageFlags.Ephemeral
  });
}

/**
 * Set the log channel
 * @param interaction Command interaction
 * @param guildId The guild ID
 */
async function setLogChannel(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const channel = interaction.options.getChannel('channel');
  if (!channel || channel.type !== 0) { // 0 is GUILD_TEXT
    await interaction.reply({
      content: 'Please provide a valid text channel.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  updateGuildConfig(guildId, { logChannelId: channel.id });
  
  await interaction.reply({
    content: `The log channel has been set to ${channel.toString()}.`,
    flags: MessageFlags.Ephemeral
  });
}

/**
 * Set the appeal channel
 * @param interaction Command interaction
 * @param guildId The guild ID
 */
async function setAppealChannel(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const channel = interaction.options.getChannel('channel');
  if (!channel || channel.type !== 0) { // 0 is GUILD_TEXT
    await interaction.reply({
      content: 'Please provide a valid text channel.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  updateGuildConfig(guildId, { appealChannelId: channel.id });
  
  await interaction.reply({
    content: `The appeal channel has been set to ${channel.toString()}.`,
    flags: MessageFlags.Ephemeral
  });
}

/**
 * Set DM notifications setting
 * @param interaction Command interaction
 * @param guildId The guild ID
 */
async function setDmNotifications(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const enabled = interaction.options.getBoolean('enabled');
  if (enabled === null) {
    await interaction.reply({
      content: 'Please specify whether DM notifications should be enabled.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  updateGuildConfig(guildId, { dmNotifications: enabled });
  
  await interaction.reply({
    content: `DM notifications have been ${enabled ? 'enabled' : 'disabled'}.`,
    flags: MessageFlags.Ephemeral
  });
}

/**
 * Set warning threshold
 * @param interaction Command interaction
 * @param guildId The guild ID
 */
async function setWarnThreshold(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const count = interaction.options.getInteger('count');
  if (!count || count < 1) {
    await interaction.reply({
      content: 'Please provide a valid threshold (must be at least 1).',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  updateGuildConfig(guildId, { warnThreshold: count });
  
  await interaction.reply({
    content: `The warning threshold has been set to ${count}. Users will receive a punishment after ${count} warnings.`,
    flags: MessageFlags.Ephemeral
  });
}

/**
 * Set whether appeals are allowed
 * @param interaction Command interaction
 * @param guildId The guild ID
 */
async function setAppealsEnabled(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const enabled = interaction.options.getBoolean('enabled');
  if (enabled === null) {
    await interaction.reply({
      content: 'Please specify whether appeals should be allowed.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  updateGuildConfig(guildId, { allowAppeals: enabled });
  
  await interaction.reply({
    content: `Appeals have been ${enabled ? 'enabled' : 'disabled'}.`,
    flags: MessageFlags.Ephemeral
  });
}

/**
 * Handle the warn command
 * @param interaction Command interaction
 */
async function handleWarnCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  
  const guildId = interaction.guild.id;
  const config = getGuildConfig(guildId);
  
  // Get command options
  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason');
  const silent = interaction.options.getBoolean('silent') || false;
  
  if (!user || !reason) {
    await interaction.reply({
      content: 'Please provide a user and reason.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Check if the user is a bot
  if (user.bot) {
    await interaction.reply({
      content: 'You cannot warn a bot.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Check if the user is trying to warn themselves
  if (user.id === interaction.user.id) {
    await interaction.reply({
      content: 'You cannot warn yourself.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Check if the user is trying to warn a moderator
  if (config.moderatorRoleId) {
    try {
      const targetMember = await interaction.guild.members.fetch(user.id);
      if (targetMember && targetMember.roles.cache.has(config.moderatorRoleId)) {
        await interaction.reply({
          content: 'You cannot warn a moderator.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    } catch (error) {
      // User may not be in the server anymore
      console.log(`Could not fetch member ${user.id}: ${error}`);
    }
  }
  
  // Create the warning
  const caseId = generateCaseId(guildId);
  const warning: Infraction = {
    id: caseId,
    userId: user.id,
    guildId: guildId,
    moderatorId: interaction.user.id,
    type: InfractionType.WARNING,
    reason: reason,
    timestamp: Date.now(),
    active: true
  };
  
  // Add the warning to the database
  addInfraction(warning);
  
  // Check if we need to escalate
  await checkAndEscalate(interaction.client, interaction.guild, user.id);
  
  // Send a DM to the user if enabled
  if (config.dmNotifications && !silent) {
    try {
      await sendWarningDM(interaction.client, guildId, user.id, warning);
    } catch (error) {
      console.error(`Error sending warning DM to ${user.tag}:`, error);
    }
  }
  
  // Log the warning
  await logModAction(interaction.client, guildId, warning);
  
  // Get the active warning count
  const activeWarnings = getActiveWarnings(guildId, user.id).length;
  
  // Reply to the command
  await interaction.reply({
    content: `⚠️ Warning issued to ${user.toString()} for: ${reason}\nThis user now has ${activeWarnings} active warning(s).`,
    ephemeral: silent // If silent, make the reply ephemeral
  });
}

/**
 * Check and escalate punishment if needed
 * @param client Discord.js client
 * @param guild The guild
 * @param userId User ID to check
 */
async function checkAndEscalate(client: Client, guild: Guild, userId: string): Promise<void> {
  const guildId = guild.id;
  const config = getGuildConfig(guildId);
  
  // Get active warnings
  const activeWarnings = getActiveWarnings(guildId, userId);
  const warningCount = activeWarnings.length;
  
  // Check if we need to escalate
  if (warningCount <= config.warnThreshold) {
    // No escalation needed yet
    return;
  }
  
  // Find which tier of punishment we need
  const punishmentTier = warningCount - config.warnThreshold;
  
  // Get the punishment for this tier
  const punishment = PUNISHMENT_TIERS.find(p => p.tier === punishmentTier);
  
  // If no punishment defined for this tier, use the highest tier
  const punishmentToApply = punishment || PUNISHMENT_TIERS[PUNISHMENT_TIERS.length - 1];
  
  // Apply the punishment
  switch (punishmentToApply.type) {
    case InfractionType.MUTE:
      await muteUser(
        client, 
        guild, 
        userId, 
        `Automatic mute after ${warningCount} warnings`, 
        'System',
        punishmentToApply.duration
      );
      break;
    
    case InfractionType.BAN:
      await banUser(
        client,
        guild,
        userId,
        `Automatic ban after ${warningCount} warnings`,
        'System',
        punishmentToApply.allowAppeal,
        0
      );
      break;
  }
}

/**
 * Send a warning DM to a user
 * @param client Discord.js client
 * @param guildId The guild ID
 * @param userId The user ID
 * @param warning The warning object
 */
async function sendWarningDM(
  client: Client, 
  guildId: string, 
  userId: string, 
  warning: Infraction
): Promise<void> {
  try {
    const user = await client.users.fetch(userId);
    const guild = await client.guilds.fetch(guildId);
    const moderator = await client.users.fetch(warning.moderatorId);
    
    const embed = new EmbedBuilder()
      .setTitle(`Warning from ${guild.name}`)
      .setColor(0xFFCC00)
      .setDescription(`You have received a warning in ${guild.name}.`)
      .addFields(
        { name: 'Reason', value: warning.reason },
        { name: 'Moderator', value: moderator.tag },
        { name: 'Time', value: `<t:${Math.floor(warning.timestamp / 1000)}:F>` }
      )
      .setFooter({ text: `Warning ID: ${warning.id}` })
      .setTimestamp();
    
    // Check if appeals are allowed
    const config = getGuildConfig(guildId);
    if (config.allowAppeals) {
      embed.addFields({
        name: 'Appeal',
        value: 'You can appeal this warning by using the `/appeal` command and selecting "Warning" as the type.'
      });
    }
    
    await user.send({ embeds: [embed] });
  } catch (error) {
    console.error(`Error sending warning DM to ${userId}:`, error);
    // User may have DMs disabled or other issues, we'll just log the error
  }
}

/**
 * Log a moderation action to the log channel
 * @param client Discord.js client
 * @param guildId The guild ID
 * @param infraction The infraction object
 */
async function logModAction(
  client: Client, 
  guildId: string, 
  infraction: Infraction
): Promise<void> {
  const config = getGuildConfig(guildId);
  
  // Check if we have a log channel
  if (!config.logChannelId) return;
  
  try {
    const guild = await client.guilds.fetch(guildId);
    const logChannel = await guild.channels.fetch(config.logChannelId);
    
    if (!logChannel || !('send' in logChannel)) {
      console.error(`Log channel ${config.logChannelId} not found or is not a text channel.`);
      return;
    }
    
    // Fetch user and moderator information
    const user = await client.users.fetch(infraction.userId).catch(() => null);
    const moderator = await client.users.fetch(infraction.moderatorId).catch(() => null);
    
    // Determine the color based on infraction type
    let color = 0x000000;
    switch (infraction.type) {
      case InfractionType.WARNING:
        color = 0xFFCC00; // Yellow
        break;
      case InfractionType.MUTE:
        color = 0xFF9900; // Orange
        break;
      case InfractionType.UNMUTE:
        color = 0x00CCFF; // Light blue
        break;
      case InfractionType.BAN:
        color = 0xFF0000; // Red
        break;
      case InfractionType.UNBAN:
        color = 0x00FF00; // Green
        break;
      case InfractionType.KICK:
        color = 0xFF6600; // Dark orange
        break;
      case InfractionType.NOTE:
        color = 0xCCCCCC; // Light gray
        break;
    }
    
    // Create the embed
    const embed = new EmbedBuilder()
      .setTitle(`${infraction.type} | Case ${infraction.id}`)
      .setColor(color)
      .setDescription(`**User:** ${user ? `${user.toString()} (${user.tag})` : infraction.userId}`)
      .addFields(
        { name: 'Reason', value: infraction.reason },
        { name: 'Moderator', value: moderator ? `${moderator.toString()} (${moderator.tag})` : infraction.moderatorId },
        { name: 'Time', value: `<t:${Math.floor(infraction.timestamp / 1000)}:F>` }
      )
      .setFooter({ text: `ID: ${infraction.id}` })
      .setTimestamp();
    
    // Add expiration if it's a temporary action
    if (infraction.expiresAt) {
      embed.addFields({
        name: 'Expires',
        value: `<t:${Math.floor(infraction.expiresAt / 1000)}:R> (<t:${Math.floor(infraction.expiresAt / 1000)}:F>)`
      });
    }
    
    // Send the log
    await (logChannel as TextChannel).send({ embeds: [embed] });
  } catch (error) {
    console.error(`Error logging moderation action:`, error);
  }
}

/**
 * Handle the warnings command
 * @param interaction Command interaction
 */
async function handleWarningsCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  
  const guildId = interaction.guild.id;
  
  // Get command options
  const user = interaction.options.getUser('user');
  
  if (!user) {
    await interaction.reply({
      content: 'Please provide a user.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Get warnings for the user
  const warnings = getUserWarnings(guildId, user.id);
  
  if (warnings.length === 0) {
    await interaction.reply({
      content: `${user.toString()} has no warnings.`,
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Count active warnings
  const activeWarnings = warnings.filter(w => w.active).length;
  
  // Create the embed
  const embed = new EmbedBuilder()
    .setTitle(`Warnings for ${user.tag}`)
    .setColor(0xFFCC00)
    .setDescription(`${user.toString()} has ${warnings.length} total warnings (${activeWarnings} active).`)
    .setTimestamp();
  
  // Add warnings to the embed
  for (let i = 0; i < warnings.length; i++) {
    const warning = warnings[i];
    
    // Fetch moderator if possible
    let moderatorName = warning.moderatorId;
    try {
      const moderator = await interaction.client.users.fetch(warning.moderatorId);
      moderatorName = moderator.tag;
    } catch (error) {
      // Just use the ID if we can't fetch the user
    }
    
    embed.addFields({
      name: `Warning ${i + 1} (${warning.active ? 'Active' : 'Inactive'})`,
      value: `**Reason:** ${warning.reason}\n**Moderator:** ${moderatorName}\n**Date:** <t:${Math.floor(warning.timestamp / 1000)}:F>\n**ID:** ${warning.id}`
    });
  }
  
  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral
  });
}

/**
 * Handle the clearwarnings command
 * @param interaction Command interaction
 */
async function handleClearWarningsCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  
  const guildId = interaction.guild.id;
  
  // Get command options
  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason');
  
  if (!user || !reason) {
    await interaction.reply({
      content: 'Please provide a user and reason.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Get active warnings for the user
  const activeWarnings = getActiveWarnings(guildId, user.id);
  
  if (activeWarnings.length === 0) {
    await interaction.reply({
      content: `${user.toString()} has no active warnings to clear.`,
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Clear all active warnings
  let clearedCount = 0;
  for (const warning of activeWarnings) {
    const success = updateInfraction(guildId, warning.id, { active: false });
    if (success) {
      clearedCount++;
      
      // Add a note about the clearing
      const note: Infraction = {
        id: generateCaseId(guildId),
        userId: user.id,
        guildId: guildId,
        moderatorId: interaction.user.id,
        type: InfractionType.NOTE,
        reason: `Cleared warning ${warning.id}: ${reason}`,
        timestamp: Date.now(),
        active: true
      };
      
      addInfraction(note);
      await logModAction(interaction.client, guildId, note);
    }
  }
  
  await interaction.reply({
    content: `Cleared ${clearedCount} warning(s) for ${user.toString()}.`,
    flags: MessageFlags.Ephemeral
  });
  
  // Notify the user if DM notifications are enabled
  const config = getGuildConfig(guildId);
  if (config.dmNotifications) {
    try {
      const embed = new EmbedBuilder()
        .setTitle(`Warnings Cleared in ${interaction.guild.name}`)
        .setColor(0x00FF00)
        .setDescription(`${clearedCount} of your warnings in ${interaction.guild.name} have been cleared.`)
        .addFields(
          { name: 'Reason', value: reason },
          { name: 'Moderator', value: interaction.user.tag },
          { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>` }
        )
        .setTimestamp();
      
      await user.send({ embeds: [embed] });
    } catch (error) {
      console.error(`Error sending warning cleared DM to ${user.tag}:`, error);
    }
  }
}

/**
 * Handle the mute command
 * @param interaction Command interaction
 */
async function handleMuteCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  
  const guildId = interaction.guild.id;
  const config = getGuildConfig(guildId);
  
  // Check if we have a muted role configured
  if (!config.mutedRoleId) {
    await interaction.reply({
      content: 'No muted role has been configured. An administrator can set one with `/modconfig mutedrole`.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Get command options
  const user = interaction.options.getUser('user');
  const durationStr = interaction.options.getString('duration');
  const reason = interaction.options.getString('reason');
  
  if (!user || !durationStr || !reason) {
    await interaction.reply({
      content: 'Please provide a user, duration, and reason.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Check if the user is a bot
  if (user.bot) {
    await interaction.reply({
      content: 'You cannot mute a bot.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Check if the user is trying to mute themselves
  if (user.id === interaction.user.id) {
    await interaction.reply({
      content: 'You cannot mute yourself.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Check if the user is trying to mute a moderator
  if (config.moderatorRoleId) {
    try {
      const targetMember = await interaction.guild.members.fetch(user.id);
      if (targetMember && targetMember.roles.cache.has(config.moderatorRoleId)) {
        await interaction.reply({
          content: 'You cannot mute a moderator.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    } catch (error) {
      // User may not be in the server anymore
      console.log(`Could not fetch member ${user.id}: ${error}`);
    }
  }
  
  // Parse the duration
  const duration = parseDuration(durationStr);
  if (duration <= 0) {
    await interaction.reply({
      content: 'Invalid duration. Please use a format like 1h, 30m, or 1d.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Defer the reply since muting might take a moment
  await interaction.deferReply();
  
  // Mute the user
  const success = await muteUser(
    interaction.client,
    interaction.guild,
    user.id,
    reason,
    interaction.user.id,
    duration
  );
  
  if (success) {
    // Format the duration for display
    const durationFormatted = formatDuration(duration);
    
    await interaction.editReply({
      content: `🔇 ${user.toString()} has been muted for ${durationFormatted}. Reason: ${reason}`
    });
  } else {
    await interaction.editReply({
      content: `Failed to mute ${user.toString()}. They may not be in the server or I may not have permission.`
    });
  }
}

/**
 * Mute a user
 * @param client Discord.js client
 * @param guild The guild
 * @param userId The user ID to mute
 * @param reason The reason for the mute
 * @param moderatorId The moderator ID
 * @param duration The duration in milliseconds (0 for permanent)
 * @returns Whether the mute was successful
 */
async function muteUser(
  client: Client,
  guild: Guild,
  userId: string,
  reason: string,
  moderatorId: string,
  duration: number = 0
): Promise<boolean> {
  const guildId = guild.id;
  const config = getGuildConfig(guildId);
  
  if (!config.mutedRoleId) {
    console.error('No muted role configured.');
    return false;
  }
  
  try {
    // Get the member
    const member = await guild.members.fetch(userId);
    
    // Get the muted role
    const mutedRole = guild.roles.cache.get(config.mutedRoleId);
    if (!mutedRole) {
      console.error(`Muted role ${config.mutedRoleId} not found.`);
      return false;
    }
    
    // Add the muted role
    await member.roles.add(mutedRole, reason);
    
    // Create the infraction
    const expiresAt = duration > 0 ? Date.now() + duration : undefined;
    const mute: Infraction = {
      id: generateCaseId(guildId),
      userId: userId,
      guildId: guildId,
      moderatorId: moderatorId,
      type: InfractionType.MUTE,
      reason: reason,
      timestamp: Date.now(),
      expiresAt: expiresAt,
      active: true
    };
    
    // Add the mute to the database
    addInfraction(mute);
    
    // Log the mute
    await logModAction(client, guildId, mute);
    
    // Set up a timer to unmute if it's temporary
    if (duration > 0) {
      // Clear any existing timer
      const timerKey = `${guildId}-${userId}`;
      if (muteTimers.has(timerKey)) {
        clearTimeout(muteTimers.get(timerKey)!);
      }
      
      // Set a new timer
      const timer = setTimeout(async () => {
        await unmuteUser(client, guild, userId, 'Mute expired', 'System');
        muteTimers.delete(timerKey);
      }, duration);
      
      muteTimers.set(timerKey, timer);
    }
    
    // Send a DM to the user if enabled
    if (config.dmNotifications) {
      try {
        const user = await client.users.fetch(userId);
        
        const embed = new EmbedBuilder()
          .setTitle(`You have been muted in ${guild.name}`)
          .setColor(0xFF9900)
          .setDescription(`You have been muted in ${guild.name}.`)
          .addFields(
            { name: 'Reason', value: reason },
            { name: 'Duration', value: duration > 0 ? formatDuration(duration) : 'Permanent' }
          )
          .setFooter({ text: `Mute ID: ${mute.id}` })
          .setTimestamp();
        
        if (duration > 0) {
          embed.addFields({
            name: 'Expires',
            value: `<t:${Math.floor(expiresAt! / 1000)}:F>))`
          });
        }
        
        // Add appeal information if appeals are allowed
        if (config.allowAppeals) {
          embed.addFields({
            name: 'Appeal',
            value: 'You can appeal this mute by using the `/appeal` command and selecting "Mute" as the type.'
          });
        }
        
        await user.send({ embeds: [embed] });
      } catch (error) {
        console.error(`Error sending mute DM to ${userId}:`, error);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Error muting user ${userId}:`, error);
    return false;
  }
}

/**
 * Handle the unmute command
 * @param interaction Command interaction
 */
async function handleUnmuteCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  
  const guildId = interaction.guild.id;
  const config = getGuildConfig(guildId);
  
  // Check if we have a muted role configured
  if (!config.mutedRoleId) {
    await interaction.reply({
      content: 'No muted role has been configured. An administrator can set one with `/modconfig mutedrole`.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Get command options
  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason');
  
  if (!user || !reason) {
    await interaction.reply({
      content: 'Please provide a user and reason.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Defer the reply since unmuting might take a moment
  await interaction.deferReply();
  
  // Unmute the user
  const success = await unmuteUser(
    interaction.client,
    interaction.guild,
    user.id,
    reason,
    interaction.user.id
  );
  
  if (success) {
    await interaction.editReply({
      content: `🔊 ${user.toString()} has been unmuted. Reason: ${reason}`
    });
  } else {
    await interaction.editReply({
      content: `Failed to unmute ${user.toString()}. They may not be in the server, may not be muted, or I may not have permission.`
    });
  }
}

/**
 * Unmute a user
 * @param client Discord.js client
 * @param guild The guild
 * @param userId The user ID to unmute
 * @param reason The reason for the unmute
 * @param moderatorId The moderator ID
 * @returns Whether the unmute was successful
 */
async function unmuteUser(
  client: Client,
  guild: Guild,
  userId: string,
  reason: string,
  moderatorId: string
): Promise<boolean> {
  const guildId = guild.id;
  const config = getGuildConfig(guildId);
  
  if (!config.mutedRoleId) {
    console.error('No muted role configured.');
    return false;
  }
  
  try {
    // Get the member
    const member = await guild.members.fetch(userId);
    
    // Get the muted role
    const mutedRole = guild.roles.cache.get(config.mutedRoleId);
    if (!mutedRole) {
      console.error(`Muted role ${config.mutedRoleId} not found.`);
      return false;
    }
    
    // Check if they have the muted role
    if (!member.roles.cache.has(config.mutedRoleId)) {
      console.error(`User ${userId} is not muted.`);
      return false;
    }
    
    // Remove the muted role
    await member.roles.remove(mutedRole, reason);
    
    // Find active mute infractions and mark as inactive
    const activeMutes = getActiveInfractions(guildId, userId)
      .filter(infraction => infraction.type === InfractionType.MUTE);
    
    for (const mute of activeMutes) {
      updateInfraction(guildId, mute.id, { active: false });
    }
    
    // Create the unmute infraction
    const unmute: Infraction = {
      id: generateCaseId(guildId),
      userId: userId,
      guildId: guildId,
      moderatorId: moderatorId,
      type: InfractionType.UNMUTE,
      reason: reason,
      timestamp: Date.now(),
      active: true
    };
    
    // Add the unmute to the database
    addInfraction(unmute);
    
    // Log the unmute
    await logModAction(client, guildId, unmute);
    
    // Clear any active mute timer
    const timerKey = `${guildId}-${userId}`;
    if (muteTimers.has(timerKey)) {
      clearTimeout(muteTimers.get(timerKey)!);
      muteTimers.delete(timerKey);
    }
    
    // Send a DM to the user if enabled
    if (config.dmNotifications) {
      try {
        const user = await client.users.fetch(userId);
        
        const embed = new EmbedBuilder()
          .setTitle(`You have been unmuted in ${guild.name}`)
          .setColor(0x00CCFF)
          .setDescription(`You have been unmuted in ${guild.name}.`)
          .addFields(
            { name: 'Reason', value: reason }
          )
          .setTimestamp();
        
        await user.send({ embeds: [embed] });
      } catch (error) {
        console.error(`Error sending unmute DM to ${userId}:`, error);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Error unmuting user ${userId}:`, error);
    return false;
  }
}

/**
 * Handle the ban command
 * @param interaction Command interaction
 */
async function handleBanCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  
  const guildId = interaction.guild.id;
  
  // Get command options
  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason');
  const allowAppeal = interaction.options.getBoolean('allow_appeal') ?? true;
  const deleteDays = interaction.options.getInteger('delete_days') ?? 0;
  
  if (!user || !reason) {
    await interaction.reply({
      content: 'Please provide a user and reason.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Check if the user is a bot
  if (user.bot) {
    await interaction.reply({
      content: 'You cannot ban a bot using this command. Use the regular Discord ban instead.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Check if the user is trying to ban themselves
  if (user.id === interaction.user.id) {
    await interaction.reply({
      content: 'You cannot ban yourself.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Check if the user is trying to ban a moderator
  const config = getGuildConfig(guildId);
  if (config.moderatorRoleId) {
    try {
      const targetMember = await interaction.guild.members.fetch(user.id);
      if (targetMember && targetMember.roles.cache.has(config.moderatorRoleId)) {
        await interaction.reply({
          content: 'You cannot ban a moderator.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    } catch (error) {
      // User may not be in the server anymore, which is fine for banning
      console.log(`Could not fetch member ${user.id}: ${error}`);
    }
  }
  
  // Defer the reply since banning might take a moment
  await interaction.deferReply();
  
  // Ban the user
  const success = await banUser(
    interaction.client,
    interaction.guild,
    user.id,
    reason,
    interaction.user.id,
    allowAppeal,
    deleteDays
  );
  
  if (success) {
    await interaction.editReply({
      content: `🔨 ${user.toString()} has been banned. Reason: ${reason}${allowAppeal ? '\nThis user can appeal their ban.' : ''}`
    });
  } else {
    await interaction.editReply({
      content: `Failed to ban ${user.toString()}. I may not have permission or they may already be banned.`
    });
  }
}

/**
 * Ban a user
 * @param client Discord.js client
 * @param guild The guild
 * @param userId The user ID to ban
 * @param reason The reason for the ban
 * @param moderatorId The moderator ID
 * @param allowAppeal Whether to allow the user to appeal
 * @param deleteDays Number of days of messages to delete
 * @returns Whether the ban was successful
 */
async function banUser(
  client: Client,
  guild: Guild,
  userId: string,
  reason: string,
  moderatorId: string,
  allowAppeal: boolean = true,
  deleteDays: number = 0
): Promise<boolean> {
  const guildId = guild.id;
  const config = getGuildConfig(guildId);
  
  try {
    // Try to send a DM to the user before banning if enabled
    if (config.dmNotifications) {
      try {
        const user = await client.users.fetch(userId);
        
        const embed = new EmbedBuilder()
          .setTitle(`You have been banned from ${guild.name}`)
          .setColor(0xFF0000)
          .setDescription(`You have been banned from ${guild.name}.`)
          .addFields(
            { name: 'Reason', value: reason }
          )
          .setTimestamp();
        
        // Add appeal information if allowed
        if (allowAppeal && config.allowAppeals) {
          embed.addFields({
            name: 'Appeal',
            value: 'You can appeal this ban by using the `/appeal` command and selecting "Ban" as the type.'
          });
        }
        
        await user.send({ embeds: [embed] });
      } catch (error) {
        console.error(`Error sending ban DM to ${userId}:`, error);
      }
    }
    
    // Ban the user
    await guild.members.ban(userId, {
      reason: reason,
      deleteMessageSeconds: deleteDays * 86400 // Convert days to seconds
    });
    
    // Create the ban infraction
    const ban: Infraction = {
      id: generateCaseId(guildId),
      userId: userId,
      guildId: guildId,
      moderatorId: moderatorId,
      type: InfractionType.BAN,
      reason: reason,
      timestamp: Date.now(),
      active: true
    };
    
    // Add the ban to the database
    addInfraction(ban);
    
    // Log the ban
    await logModAction(client, guildId, ban);
    
    return true;
  } catch (error) {
    console.error(`Error banning user ${userId}:`, error);
    return false;
  }
}

/**
 * Handle the unban command
 * @param interaction Command interaction
 */
async function handleUnbanCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  
  const guildId = interaction.guild.id;
  
  // Get command options
  const userId = interaction.options.getString('userid');
  const reason = interaction.options.getString('reason');
  
  if (!userId || !reason) {
    await interaction.reply({
      content: 'Please provide a user ID and reason.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Defer the reply since unbanning might take a moment
  await interaction.deferReply();
  
  // Unban the user
  const success = await unbanUser(
    interaction.client,
    interaction.guild,
    userId,
    reason,
    interaction.user.id
  );
  
  if (success) {
    await interaction.editReply({
      content: `🔓 User <@${userId}> has been unbanned. Reason: ${reason}`
    });
  } else {
    await interaction.editReply({
      content: `Failed to unban user with ID ${userId}. They may not be banned or I may not have permission.`
    });
  }
}

/**
 * Unban a user
 * @param client Discord.js client
 * @param guild The guild
 * @param userId The user ID to unban
 * @param reason The reason for the unban
 * @param moderatorId The moderator ID
 * @returns Whether the unban was successful
 */
async function unbanUser(
  client: Client,
  guild: Guild,
  userId: string,
  reason: string,
  moderatorId: string
): Promise<boolean> {
  const guildId = guild.id;
  const config = getGuildConfig(guildId);
  
  try {
    // Unban the user
    await guild.members.unban(userId, reason);
    
    // Find active ban infractions and mark as inactive
    const activeBans = getActiveInfractions(guildId, userId)
      .filter(infraction => infraction.type === InfractionType.BAN);
    
    for (const ban of activeBans) {
      updateInfraction(guildId, ban.id, { active: false });
    }
    
    // Create the unban infraction
    const unban: Infraction = {
      id: generateCaseId(guildId),
      userId: userId,
      guildId: guildId,
      moderatorId: moderatorId,
      type: InfractionType.UNBAN,
      reason: reason,
      timestamp: Date.now(),
      active: true
    };
    
    // Add the unban to the database
    addInfraction(unban);
    
    // Log the unban
    await logModAction(client, guildId, unban);
    
    // Try to send a DM to the user if enabled
    if (config.dmNotifications) {
      try {
        const user = await client.users.fetch(userId);
        
        const embed = new EmbedBuilder()
          .setTitle(`You have been unbanned from ${guild.name}`)
          .setColor(0x00FF00)
          .setDescription(`You have been unbanned from ${guild.name}.`)
          .addFields(
            { name: 'Reason', value: reason }
          )
          .setTimestamp();
        
        await user.send({ embeds: [embed] });
      } catch (error) {
        console.error(`Error sending unban DM to ${userId}:`, error);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Error unbanning user ${userId}:`, error);
    return false;
  }
}

/**
 * Handle the kick command
 * @param interaction Command interaction
 */
async function handleKickCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  
  const guildId = interaction.guild.id;
  
  // Get command options
  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason');
  
  if (!user || !reason) {
    await interaction.reply({
      content: 'Please provide a user and reason.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Check if the user is a bot
  if (user.bot) {
    await interaction.reply({
      content: 'You cannot kick a bot using this command. Use the regular Discord kick instead.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Check if the user is trying to kick themselves
  if (user.id === interaction.user.id) {
    await interaction.reply({
      content: 'You cannot kick yourself.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Check if the user is trying to kick a moderator
  const config = getGuildConfig(guildId);
  if (config.moderatorRoleId) {
    try {
      const targetMember = await interaction.guild.members.fetch(user.id);
      if (targetMember && targetMember.roles.cache.has(config.moderatorRoleId)) {
        await interaction.reply({
          content: 'You cannot kick a moderator.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    } catch (error) {
      // User may not be in the server anymore
      console.log(`Could not fetch member ${user.id}: ${error}`);
      await interaction.reply({
        content: 'That user is not in the server.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
  }
  
  // Defer the reply since kicking might take a moment
  await interaction.deferReply();
  
  // Kick the user
  const success = await kickUser(
    interaction.client,
    interaction.guild,
    user.id,
    reason,
    interaction.user.id
  );
  
  if (success) {
    await interaction.editReply({
      content: `👢 ${user.toString()} has been kicked. Reason: ${reason}`
    });
  } else {
    await interaction.editReply({
      content: `Failed to kick ${user.toString()}. They may not be in the server or I may not have permission.`
    });
  }
}

/**
 * Kick a user
 * @param client Discord.js client
 * @param guild The guild
 * @param userId The user ID to kick
 * @param reason The reason for the kick
 * @param moderatorId The moderator ID
 * @returns Whether the kick was successful
 */
async function kickUser(
  client: Client,
  guild: Guild,
  userId: string,
  reason: string,
  moderatorId: string
): Promise<boolean> {
  const guildId = guild.id;
  const config = getGuildConfig(guildId);
  
  try {
    // Get the member
    const member = await guild.members.fetch(userId);
    
    // Try to send a DM to the user before kicking if enabled
    if (config.dmNotifications) {
      try {
        const user = member.user;
        
        const embed = new EmbedBuilder()
          .setTitle(`You have been kicked from ${guild.name}`)
          .setColor(0xFF6600)
          .setDescription(`You have been kicked from ${guild.name}.`)
          .addFields(
            { name: 'Reason', value: reason }
          )
          .setTimestamp();
        
        await user.send({ embeds: [embed] });
      } catch (error) {
        console.error(`Error sending kick DM to ${userId}:`, error);
      }
    }
    
    // Kick the user
    await member.kick(reason);
    
    // Create the kick infraction
    const kick: Infraction = {
      id: generateCaseId(guildId),
      userId: userId,
      guildId: guildId,
      moderatorId: moderatorId,
      type: InfractionType.KICK,
      reason: reason,
      timestamp: Date.now(),
      active: true
    };
    
    // Add the kick to the database
    addInfraction(kick);
    
    // Log the kick
    await logModAction(client, guildId, kick);
    
    return true;
  } catch (error) {
    console.error(`Error kicking user ${userId}:`, error);
    return false;
  }
}

/**
 * Handle the note command
 * @param interaction Command interaction
 */
async function handleNoteCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  
  const guildId = interaction.guild.id;
  
  // Get command options
  const user = interaction.options.getUser('user');
  const content = interaction.options.getString('content');
  
  if (!user || !content) {
    await interaction.reply({
      content: 'Please provide a user and note content.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Create the note
  const note: Infraction = {
    id: generateCaseId(guildId),
    userId: user.id,
    guildId: guildId,
    moderatorId: interaction.user.id,
    type: InfractionType.NOTE,
    reason: content,
    timestamp: Date.now(),
    active: true
  };
  
  // Add the note to the database
  addInfraction(note);
  
  // Log the note
  await logModAction(interaction.client, guildId, note);
  
  await interaction.reply({
    content: `📝 Note added for ${user.toString()}.`,
    ephemeral: true
  });
}

/**
 * Handle the appeal command
 * @param interaction Command interaction
 */
async function handleAppealCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    // Allow the command to be used in DMs for banned users
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'Please specify the type of punishment you are appealing.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
  }
  
  const guildId = interaction.guild?.id || interaction.guildId!;
  const config = getGuildConfig(guildId);
  
  // Check if appeals are allowed
  if (!config.allowAppeals) {
    await interaction.reply({
      content: 'Appeals are not allowed in this server.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Get the punishment type
  const type = interaction.options.getString('type') as InfractionType;
  
  // Get the user's infractions of this type
  const userInfractions = getActiveInfractions(guildId, interaction.user.id)
    .filter(infraction => infraction.type === type)
    .sort((a, b) => b.timestamp - a.timestamp); // Most recent first
  
  if (userInfractions.length === 0) {
    await interaction.reply({
      content: `You don't have any active ${type.toLowerCase()}s to appeal.`,
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Check if they already have a pending appeal
  const userAppeals = getUserAppeals(guildId, interaction.user.id)
    .filter(appeal => appeal.status === AppealStatus.PENDING);
  
  if (userAppeals.length > 0) {
    await interaction.reply({
      content: 'You already have a pending appeal. Please wait for that to be reviewed before submitting another.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Start the appeal process in DMs
  try {
    await interaction.reply({
      content: 'I\'ve sent you a DM with the appeal form.',
      flags: MessageFlags.Ephemeral
    });
    
    // Create and send the appeal form
    await startAppealProcess(interaction.client, guildId, interaction.user.id, type, userInfractions[0]);
  } catch (error) {
    console.error('Error starting appeal process:', error);
    
    // Only update if we already replied
    if (interaction.replied) {
      await interaction.followUp({
        content: 'There was an error starting the appeal process. Do you have DMs enabled?',
        flags: MessageFlags.Ephemeral
      });
    } else {
      await interaction.reply({
        content: 'There was an error starting the appeal process. Do you have DMs enabled?',
        flags: MessageFlags.Ephemeral
      });
    }
  }
}

/**
 * Start the appeal process in DMs
 * @param client Discord.js client
 * @param guildId The guild ID
 * @param userId The user ID
 * @param type The infraction type
 * @param infraction The infraction being appealed
 */
async function startAppealProcess(
  client: Client,
  guildId: string,
  userId: string,
  type: InfractionType,
  infraction: Infraction
): Promise<void> {
  // Create the DM channel if it doesn't exist
  const user = await client.users.fetch(userId);
  const guild = await client.guilds.fetch(guildId);
  
  // Create the appeal form
  const modal = new ModalBuilder()
    .setCustomId(`appeal_form_${guildId}_${infraction.id}`)
    .setTitle(`Appeal ${type.charAt(0) + type.slice(1).toLowerCase()}`);
  
  // Add common fields
  const reasonInput = new TextInputBuilder()
    .setCustomId('appeal_reason')
    .setLabel('Why should this decision be reconsidered?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000);
  
  const reasonRow = new ActionRowBuilder<TextInputBuilder>()
    .addComponents(reasonInput);
  
  modal.addComponents(reasonRow);
  
  // Add type-specific fields
  if (type === InfractionType.BAN) {
    const futureInput = new TextInputBuilder()
      .setCustomId('appeal_future')
      .setLabel('How will you follow the rules in the future?')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);
    
    const futureRow = new ActionRowBuilder<TextInputBuilder>()
      .addComponents(futureInput);
    
    modal.addComponents(futureRow);
  }
  
  // Send the appeal form
  const embed = new EmbedBuilder()
    .setTitle(`Appeal ${type.charAt(0) + type.slice(1).toLowerCase()} from ${guild.name}`)
    .setColor(0x0099FF)
    .setDescription(`Please fill out this form to appeal your ${type.toLowerCase()} from ${guild.name}.`)
    .addFields(
      { name: 'Original Reason', value: infraction.reason },
      { name: 'Date', value: `<t:${Math.floor(infraction.timestamp / 1000)}:F>` },
      { name: 'Instructions', value: 'Click the button below to open the appeal form.' }
    )
    .setTimestamp();
  
  // Create the button for opening the modal
  const appealButton = new ButtonBuilder()
    .setCustomId(`open_appeal_modal_${guildId}_${infraction.id}`)
    .setLabel('Open Appeal Form')
    .setStyle(ButtonStyle.Primary);
  
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(appealButton);
  
  // Send the initial message
  const dm = await user.send({
    embeds: [embed],
    components: [row]
  });
  
  // Store the DM message ID for later reference
  // We'll handle the actual modal submission in a separate handler
  const appealContext = {
    userId,
    guildId,
    infractionId: infraction.id,
    type,
    dmMessageId: dm.id
  };
  
  // For now we'll store this in memory, but you might want to persist it
  pendingAppealForms.set(`${guildId}_${infraction.id}`, appealContext);
}

// Store pending appeal forms
const pendingAppealForms = new Map<string, any>();

/**
 * Handle opening the appeal modal
 * @param interaction Button interaction
 */
export async function handleOpenAppealModal(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;
  
  // Check if this is an appeal button
  if (!customId.startsWith('open_appeal_modal_')) return;
  
  // Parse the custom ID to get the context
  const parts = customId.split('_');
  const guildId = parts[3];
  const infractionId = parts[4];
  
  // Get the appeal context
  const context = pendingAppealForms.get(`${guildId}_${infractionId}`);
  if (!context) {
    await interaction.reply({
      content: 'This appeal form has expired. Please start the process again with the `/appeal` command.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Get the infraction
  const infraction = getInfraction(guildId, infractionId);
  if (!infraction) {
    await interaction.reply({
      content: 'The infraction being appealed could not be found. Please contact a server administrator.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Create the modal based on the infraction type
  const modal = new ModalBuilder()
    .setCustomId(`appeal_modal_${guildId}_${infractionId}`)
    .setTitle(`Appeal ${infraction.type.charAt(0) + infraction.type.slice(1).toLowerCase()}`);
  
  // Add the reason field
  const reasonInput = new TextInputBuilder()
    .setCustomId('appeal_reason')
    .setLabel('Why should this decision be reconsidered?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000);
  
  const reasonRow = new ActionRowBuilder<TextInputBuilder>()
    .addComponents(reasonInput);
  
  modal.addComponents(reasonRow);
  
  // Add type-specific fields
  if (infraction.type === InfractionType.BAN || infraction.type === InfractionType.MUTE) {
    const futureInput = new TextInputBuilder()
      .setCustomId('appeal_future')
      .setLabel('How will you follow the rules in the future?')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);
    
    const futureRow = new ActionRowBuilder<TextInputBuilder>()
      .addComponents(futureInput);
    
    modal.addComponents(futureRow);
  }
  
  // Show the modal
  await interaction.showModal(modal);
}

/**
 * Handle the appeal modal submission
 * @param interaction Modal submission interaction
 */
export async function handleAppealModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const customId = interaction.customId;
  
  // Check if this is an appeal modal
  if (!customId.startsWith('appeal_modal_')) return;
  
  // Parse the custom ID to get the context
  const parts = customId.split('_');
  const guildId = parts[2];
  const infractionId = parts[3];
  
  // Get the infraction
  const infraction = getInfraction(guildId, infractionId);
  if (!infraction) {
    await interaction.reply({
      content: 'The infraction being appealed could not be found. Please contact a server administrator.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Get the form inputs
  const reason = interaction.fields.getTextInputValue('appeal_reason');
  let appealText = reason;
  
  // Add the future behavior if provided
  if (infraction.type === InfractionType.BAN || infraction.type === InfractionType.MUTE) {
    const future = interaction.fields.getTextInputValue('appeal_future');
    appealText += `\n\nFuture behavior: ${future}`;
  }
  
  // Create the appeal
  const appeal: Appeal = {
    userId: interaction.user.id,
    caseId: infractionId,
    infractionType: infraction.type,
    reason: appealText,
    status: AppealStatus.PENDING,
    timestamp: Date.now()
  };
  
  // Add the appeal to the database
  addAppeal(appeal);
  
  // Send confirmation to the user
  await interaction.reply({
    content: 'Your appeal has been submitted. You will be notified when it has been reviewed.',
    flags: MessageFlags.Ephemeral
  });
  
  // Forward the appeal to the appeal channel
  await sendAppealToChannel(interaction.client, guildId, appeal, infraction);
}

/**
 * Send an appeal to the appeal channel
 * @param client Discord.js client
 * @param guildId The guild ID
 * @param appeal The appeal
 * @param infraction The infraction being appealed
 */
async function sendAppealToChannel(
  client: Client,
  guildId: string,
  appeal: Appeal,
  infraction: Infraction
): Promise<void> {
  const config = getGuildConfig(guildId);
  
  // Check if we have an appeal channel
  if (!config.appealChannelId) {
    console.error('No appeal channel configured.');
    return;
  }
  
  try {
    const guild = await client.guilds.fetch(guildId);
    const appealChannel = await guild.channels.fetch(config.appealChannelId);
    
    if (!appealChannel || !('send' in appealChannel)) {
      console.error(`Appeal channel ${config.appealChannelId} not found or is not a text channel.`);
      return;
    }
    
    // Fetch user information
    const user = await client.users.fetch(appeal.userId).catch(() => null);
    const moderator = await client.users.fetch(infraction.moderatorId).catch(() => null);
    
    // Determine the color based on infraction type
    let color = 0x000000;
    switch (infraction.type) {
      case InfractionType.WARNING:
        color = 0xFFCC00; // Yellow
        break;
      case InfractionType.MUTE:
        color = 0xFF9900; // Orange
        break;
      case InfractionType.BAN:
        color = 0xFF0000; // Red
        break;
    }
    
    // Create the embed
    const embed = new EmbedBuilder()
      .setTitle(`Appeal | ${infraction.type} | Case ${infraction.id}`)
      .setColor(color)
      .setDescription(`**User:** ${user ? `${user.toString()} (${user.tag})` : appeal.userId}`)
      .addFields(
        { name: 'Original Reason', value: infraction.reason },
        { name: 'Original Moderator', value: moderator ? `${moderator.toString()} (${moderator.tag})` : infraction.moderatorId },
        { name: 'Original Time', value: `<t:${Math.floor(infraction.timestamp / 1000)}:F>` },
        { name: 'Appeal Reason', value: appeal.reason },
        { name: 'Appeal Time', value: `<t:${Math.floor(appeal.timestamp / 1000)}:F>` }
      )
      .setFooter({ text: `Appeal ID: ${infraction.id}_appeal` })
      .setTimestamp();
    
    // Create approval/denial buttons
    const approveButton = new ButtonBuilder()
      .setCustomId(`approve_appeal_${infraction.id}`)
      .setLabel('Approve')
      .setStyle(ButtonStyle.Success);
    
    const denyButton = new ButtonBuilder()
      .setCustomId(`deny_appeal_${infraction.id}`)
      .setLabel('Deny')
      .setStyle(ButtonStyle.Danger);
    
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(approveButton, denyButton);
    
    // Send the appeal
    await (appealChannel as TextChannel).send({
      embeds: [embed],
      components: [row]
    });
  } catch (error) {
    console.error('Error sending appeal to channel:', error);
  }
}

/**
 * Handle the appeal approval/denial
 * @param interaction Button interaction
 */
export async function handleAppealDecision(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;
  
  // Check if this is an appeal decision
  if (!customId.startsWith('approve_appeal_') && !customId.startsWith('deny_appeal_')) return;
  
  // Check if the user has permission
  const member = interaction.member;
  if (!member || !('permissions' in member) || !(member.permissions as any).has(PermissionFlagsBits.ModerateMembers)) {
    await interaction.reply({
      content: 'You do not have permission to handle appeals.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Parse the custom ID to get the infraction ID
  const infractionId = customId.split('_')[2];
  
  // Get the infraction
  const guildId = interaction.guildId!;
  const infraction = getInfraction(guildId, infractionId);
  if (!infraction) {
    await interaction.reply({
      content: 'The infraction being appealed could not be found.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Get the appeal
  const appeal = getAppeal(guildId, infractionId);
  if (!appeal) {
    await interaction.reply({
      content: 'The appeal could not be found.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Check if the appeal has already been handled
  if (appeal.status !== AppealStatus.PENDING) {
    await interaction.reply({
      content: 'This appeal has already been handled.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Ask for a reason
  const modal = new ModalBuilder()
    .setCustomId(`appeal_decision_${customId.startsWith('approve_appeal_') ? 'approve' : 'deny'}_${infractionId}`)
    .setTitle(`${customId.startsWith('approve_appeal_') ? 'Approve' : 'Deny'} Appeal`);
  
  const reasonInput = new TextInputBuilder()
    .setCustomId('decision_reason')
    .setLabel('Reason for decision')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000);
  
  const reasonRow = new ActionRowBuilder<TextInputBuilder>()
    .addComponents(reasonInput);
  
  modal.addComponents(reasonRow);
  
  // Show the modal
  await interaction.showModal(modal);
}

/**
 * Handle the appeal decision modal submission
 * @param interaction Modal submission interaction
 */
export async function handleAppealDecisionSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const customId = interaction.customId;
  
  // Check if this is an appeal decision
  if (!customId.startsWith('appeal_decision_')) return;
  
  // Parse the custom ID to get the decision and infraction ID
  const parts = customId.split('_');
  const decision = parts[2] as 'approve' | 'deny';
  const infractionId = parts[3];
  
  // Get the infraction
  const guildId = interaction.guildId!;
  const infraction = getInfraction(guildId, infractionId);
  if (!infraction) {
    await interaction.reply({
      content: 'The infraction being appealed could not be found.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Get the appeal
  const appeal = getAppeal(guildId, infractionId);
  if (!appeal) {
    await interaction.reply({
      content: 'The appeal could not be found.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Get the reason
  const reason = interaction.fields.getTextInputValue('decision_reason');
  
  // Update the appeal
  updateAppeal(guildId, infractionId, {
    status: decision === 'approve' ? AppealStatus.APPROVED : AppealStatus.DENIED,
    reviewerId: interaction.user.id,
    reviewReason: reason,
    reviewTimestamp: Date.now()
  });
  
  // If approved, take action based on the infraction type
  if (decision === 'approve') {
    switch (infraction.type) {
      case InfractionType.WARNING:
        // Clear the warning
        updateInfraction(guildId, infractionId, { active: false });
        break;
        
      case InfractionType.MUTE:
        // Unmute the user
        try {
          const guild = await interaction.client.guilds.fetch(guildId);
          await unmuteUser(
            interaction.client,
            guild,
            infraction.userId,
            `Appeal approved: ${reason}`,
            interaction.user.id
          );
        } catch (error) {
          console.error('Error unmuting user:', error);
        }
        break;
        
      case InfractionType.BAN:
        // Unban the user
        try {
          const guild = await interaction.client.guilds.fetch(guildId);
          await unbanUser(
            interaction.client,
            guild,
            infraction.userId,
            `Appeal approved: ${reason}`,
            interaction.user.id
          );
        } catch (error) {
          console.error('Error unbanning user:', error);
        }
        break;
    }
  }
  
  // Update the original message
  try {
    // Get the message from the interaction
    const message = interaction.message;
    if (!message) {
      console.error('Appeal message not found.');
      await interaction.reply({
        content: 'The appeal has been ' + (decision === 'approve' ? 'approved' : 'denied') + ', but I couldn\'t update the original message.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    const embed = EmbedBuilder.from(message.embeds[0])
      .setTitle(`${decision === 'approve' ? 'Approved' : 'Denied'} Appeal | ${infraction.type} | Case ${infraction.id}`)
      .setColor(decision === 'approve' ? 0x00FF00 : 0xFF0000) // Green for approved, red for denied
      .addFields({
        name: `${decision === 'approve' ? 'Approval' : 'Denial'} Reason`,
        value: reason
      })
      .setTimestamp();
    
    // Disable the buttons
    const disabledRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_appeal_${infractionId}`)
          .setLabel('Approve')
          .setStyle(ButtonStyle.Success)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`deny_appeal_${infractionId}`)
          .setLabel('Deny')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true)
      );
    
    // Use reply instead of update for modal submissions
    await interaction.reply({
      content: `Appeal ${decision === 'approve' ? 'approved' : 'denied'} successfully.`,
      flags: MessageFlags.Ephemeral
    });
    
    // Try to edit the original message if possible
    if (message.editable) {
      await message.edit({ embeds: [embed], components: [disabledRow] });
    }
  } catch (error) {
    console.error('Error updating appeal message:', error);
    
    if (!interaction.replied) {
      await interaction.reply({
        content: `Appeal ${decision === 'approve' ? 'approved' : 'denied'} successfully, but there was an error updating the message.`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
  
  // Notify the user
  try {
    const user = await interaction.client.users.fetch(infraction.userId);
    const guild = await interaction.client.guilds.fetch(guildId);
    
    const embed = new EmbedBuilder()
      .setTitle(`Appeal ${decision === 'approve' ? 'Approved' : 'Denied'}`)
      .setColor(decision === 'approve' ? 0x00FF00 : 0xFF0000)
      .setDescription(`Your appeal for the ${infraction.type.toLowerCase()} in ${guild.name} has been ${decision === 'approve' ? 'approved' : 'denied'}.`)
      .addFields(
        { name: 'Original Infraction', value: infraction.reason },
        { name: 'Decision Reason', value: reason },
        { name: 'Moderator', value: interaction.user.tag }
      )
      .setTimestamp();
    
    await user.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error notifying user of appeal decision:', error);
  }
}

/**
 * Handle the check command
 * @param interaction Command interaction
 */
async function handleCheckCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  
  const guildId = interaction.guild.id;
  
  // Get command options
  const user = interaction.options.getUser('user');
  
  if (!user) {
    await interaction.reply({
      content: 'Please provide a user.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Get infractions for the user
  const infractions = getUserInfractions(guildId, user.id);
  
  if (infractions.length === 0) {
    await interaction.reply({
      content: `${user.toString()} has no moderation history.`,
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Sort infractions by timestamp (newest first)
  infractions.sort((a, b) => b.timestamp - a.timestamp);
  
  // Count active infractions by type
  const activeCounts: Record<InfractionType, number> = {
    [InfractionType.WARNING]: 0,
    [InfractionType.MUTE]: 0,
    [InfractionType.UNMUTE]: 0,
    [InfractionType.BAN]: 0,
    [InfractionType.UNBAN]: 0,
    [InfractionType.KICK]: 0,
    [InfractionType.NOTE]: 0
  };
  
  infractions.forEach(infraction => {
    if (infraction.active) {
      activeCounts[infraction.type]++;
    }
  });
  
  // Create the embed
  const embed = new EmbedBuilder()
    .setTitle(`Moderation History for ${user.tag}`)
    .setColor(0x5865F2) // Discord blurple
    .setDescription(`${user.toString()} has ${infractions.length} total infractions.`)
    .addFields({
      name: 'Active Infractions',
      value: `Warnings: ${activeCounts[InfractionType.WARNING]}\nMutes: ${activeCounts[InfractionType.MUTE]}\nBans: ${activeCounts[InfractionType.BAN]}`
    })
    .setTimestamp();
  
  // Add recent infractions (limit to 10 to avoid hitting Discord's limits)
  const recentInfractions = infractions.slice(0, 10);
  
  for (let i = 0; i < recentInfractions.length; i++) {
    const infraction = recentInfractions[i];
    
    // Fetch moderator if possible
    let moderatorName = infraction.moderatorId;
    try {
      const moderator = await interaction.client.users.fetch(infraction.moderatorId);
      moderatorName = moderator.tag;
    } catch (error) {
      // Just use the ID if we can't fetch the user
    }
    
    embed.addFields({
      name: `${infraction.type} (${infraction.active ? 'Active' : 'Inactive'})`,
      value: `**Reason:** ${infraction.reason}\n**Moderator:** ${moderatorName}\n**Date:** <t:${Math.floor(infraction.timestamp / 1000)}:F>\n**ID:** ${infraction.id}`
    });
  }
  
  // Add a note if there are more infractions
  if (infractions.length > 10) {
    embed.addFields({
      name: 'Note',
      value: `Showing 10 most recent infractions. ${infractions.length - 10} more infractions not shown.`
    });
  }
  
  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral
  });
}

//=============================================================================
// UTILITY FUNCTIONS
//=============================================================================

/**
 * Parse a duration string
 * @param durationStr Duration string (e.g., 1h, 30m, 1d)
 * @returns Duration in milliseconds
 */
function parseDuration(durationStr: string): number {
  const regex = /^(\d+)([smhdw])$/i;
  const match = durationStr.match(regex);
  
  if (!match) return 0;
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  switch (unit) {
    case 's': return value * 1000; // seconds
    case 'm': return value * 60 * 1000; // minutes
    case 'h': return value * 60 * 60 * 1000; // hours
    case 'd': return value * 24 * 60 * 60 * 1000; // days
    case 'w': return value * 7 * 24 * 60 * 60 * 1000; // weeks
    default: return 0;
  }
}

/**
 * Format a duration in milliseconds to a human-readable string
 * @param duration Duration in milliseconds
 * @returns Formatted duration string
 */
function formatDuration(duration: number): string {
  const seconds = Math.floor(duration / 1000);
  
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} day${days !== 1 ? 's' : ''}`;
  }
  
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks !== 1 ? 's' : ''}`;
}

//=============================================================================
// BUTTON & MODAL HANDLERS
//=============================================================================

/**
 * Handle button interactions for the warning system
 * @param interaction Button interaction
 */
export async function handleModButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;
  
  if (customId.startsWith('open_appeal_modal_')) {
    await handleOpenAppealModal(interaction);
  } else if (customId.startsWith('approve_appeal_') || customId.startsWith('deny_appeal_')) {
    await handleAppealDecision(interaction);
  }
}

/**
 * Handle modal submissions for the warning system
 * @param interaction Modal submission interaction
 */
export async function handleModModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const customId = interaction.customId;
  
  if (customId.startsWith('appeal_modal_')) {
    await handleAppealModalSubmit(interaction);
  } else if (customId.startsWith('appeal_decision_')) {
    await handleAppealDecisionSubmit(interaction);
  }
}
