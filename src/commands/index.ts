/**
 * Command System for The Roommates Helper
 * --------------------------------------
 * Centralized command registration and handling system
 */

import { Client, REST, Routes, Events, Collection } from 'discord.js';
import { BotCommand } from '../types';
import { logWithEmoji } from '../utils';

// Import command categories (we'll create these next)
import { moderationCommands } from './moderation';
import { utilityCommands } from './utility';
import { verificationCommands } from './verification';

//=============================================================================
// COMMAND COLLECTIONS
//=============================================================================

// Collect all commands from different categories
const allCommands: BotCommand[] = [
  ...moderationCommands,
  ...utilityCommands,
  ...verificationCommands
];

// Create a collection for quick command lookup
const commandCollection = new Collection<string, BotCommand>();

// Cooldown tracking
const cooldowns = new Collection<string, Collection<string, number>>();

//=============================================================================
// COMMAND SETUP
//=============================================================================

/**
 * Setup and register all commands
 */
export async function setupCommands(client: Client): Promise<void> {
  try {
    logWithEmoji('info', 'Setting up command system...', 'Commands');
    
    // Populate command collection
    for (const command of allCommands) {
      commandCollection.set(command.data.name, command);
    }
    
    // Register slash commands with Discord
    await registerSlashCommands();
    
    // Setup command interaction handlers
    setupCommandHandlers(client);
    
    logWithEmoji('success', `Successfully registered ${allCommands.length} commands`, 'Commands');
    
  } catch (error) {
    logWithEmoji('error', `Failed to setup commands: ${error}`, 'Commands');
    throw error;
  }
}

/**
 * Register slash commands with Discord API
 */
async function registerSlashCommands(): Promise<void> {
  const TOKEN = process.env.DISCORD_TOKEN!;
  const CLIENT_ID = process.env.CLIENT_ID!;
  const GUILD_ID = process.env.GUILD_ID; // Optional for development

  if (!CLIENT_ID) {
    throw new Error('CLIENT_ID not found in environment variables');
  }

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  
  // Convert commands to Discord API format
  const commandData = allCommands.map(cmd => cmd.data.toJSON());
  
  try {
    logWithEmoji('info', 'Started refreshing application slash commands...', 'Commands');
    
    if (GUILD_ID) {
      // Guild commands (instant registration for development)
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commandData }
      );
      logWithEmoji('success', `Successfully registered commands to guild ${GUILD_ID}`, 'Commands');
    } else {
      // Global commands (can take up to an hour to propagate)
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commandData }
      );
      logWithEmoji('success', 'Successfully registered global commands', 'Commands');
    }
    
  } catch (error) {
    logWithEmoji('error', `Failed to register commands: ${error}`, 'Commands');
    throw error;
  }
}

/**
 * Setup command interaction handlers
 */
function setupCommandHandlers(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction) => {
    // Only handle chat input (slash) commands
    if (!interaction.isChatInputCommand()) return;
    
    const commandName = interaction.commandName;
    const command = commandCollection.get(commandName);
    
    if (!command) {
      logWithEmoji('warn', `Unknown command attempted: ${commandName}`, 'Commands');
      await interaction.reply({
        content: 'This command is not recognized.',
        ephemeral: true
      }).catch(() => {});
      return;
    }
    
    // Check cooldowns
    if (command.cooldown && !checkCooldown(interaction.user.id, commandName, command.cooldown)) {
      const timeLeft = getCooldownTimeLeft(interaction.user.id, commandName);
      await interaction.reply({
        content: `Please wait ${Math.ceil(timeLeft / 1000)} more seconds before using this command again.`,
        ephemeral: true
      }).catch(() => {});
      return;
    }
    
    try {
      // Log command usage
      logWithEmoji('info', 
        `Command executed: ${commandName} by ${interaction.user.tag} in ${interaction.guild?.name || 'DMs'}`,
        'Commands'
      );
      
      // Execute the command
      await command.execute(interaction);
      
      // Set cooldown if applicable
      if (command.cooldown) {
        setCooldown(interaction.user.id, commandName, command.cooldown);
      }
      
    } catch (error) {
      logWithEmoji('error', 
        `Error executing command ${commandName}: ${error}`,
        'Commands'
      );
      
      // Send error response to user
      const errorMessage = 'There was an error executing this command. Please try again later.';
      
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      } catch (replyError) {
        logWithEmoji('error', `Failed to send error message: ${replyError}`, 'Commands');
      }
    }
  });
  
  logWithEmoji('success', 'Command interaction handlers registered', 'Commands');
}

//=============================================================================
// COOLDOWN MANAGEMENT
//=============================================================================

/**
 * Check if a user is on cooldown for a command
 */
function checkCooldown(userId: string, commandName: string, cooldownAmount: number): boolean {
  if (!cooldowns.has(commandName)) {
    cooldowns.set(commandName, new Collection());
  }
  
  const now = Date.now();
  const timestamps = cooldowns.get(commandName)!;
  
  if (timestamps.has(userId)) {
    const expirationTime = timestamps.get(userId)! + cooldownAmount;
    
    if (now < expirationTime) {
      return false; // User is on cooldown
    }
  }
  
  return true; // User is not on cooldown
}

/**
 * Set cooldown for a user on a command
 */
function setCooldown(userId: string, commandName: string, cooldownAmount: number): void {
  if (!cooldowns.has(commandName)) {
    cooldowns.set(commandName, new Collection());
  }
  
  const timestamps = cooldowns.get(commandName)!;
  timestamps.set(userId, Date.now());
  
  // Clean up expired cooldowns
  setTimeout(() => {
    timestamps.delete(userId);
  }, cooldownAmount);
}

/**
 * Get remaining cooldown time for a user on a command
 */
function getCooldownTimeLeft(userId: string, commandName: string): number {
  if (!cooldowns.has(commandName)) return 0;
  
  const timestamps = cooldowns.get(commandName)!;
  if (!timestamps.has(userId)) return 0;
  
  const command = commandCollection.get(commandName);
  if (!command?.cooldown) return 0;
  
  const expirationTime = timestamps.get(userId)! + command.cooldown;
  return Math.max(0, expirationTime - Date.now());
}

//=============================================================================
// COMMAND UTILITIES
//=============================================================================

/**
 * Get command by name
 */
export function getCommand(name: string): BotCommand | undefined {
  return commandCollection.get(name);
}

/**
 * Get all commands
 */
export function getAllCommands(): BotCommand[] {
  return Array.from(commandCollection.values());
}

/**
 * Get commands by category
 */
export function getCommandsByCategory(category: 'moderation' | 'utility' | 'verification'): BotCommand[] {
  switch (category) {
    case 'moderation': return moderationCommands;
    case 'utility': return utilityCommands;
    case 'verification': return verificationCommands;
    default: return [];
  }
}

/**
 * Check if a command exists
 */
export function commandExists(name: string): boolean {
  return commandCollection.has(name);
}

//=============================================================================
// COMMAND STATISTICS
//=============================================================================

const commandStats = new Collection<string, number>();

/**
 * Track command usage
 */
export function trackCommandUsage(commandName: string): void {
  const currentCount = commandStats.get(commandName) || 0;
  commandStats.set(commandName, currentCount + 1);
}

/**
 * Get command usage statistics
 */
export function getCommandStats(): { commandName: string; usageCount: number }[] {
  return Array.from(commandStats.entries()).map(([commandName, usageCount]) => ({
    commandName,
    usageCount
  })).sort((a, b) => b.usageCount - a.usageCount);
}

/**
 * Get total command executions
 */
export function getTotalCommandExecutions(): number {
  return Array.from(commandStats.values()).reduce((total, count) => total + count, 0);
}

//=============================================================================
// EXPORTS
//=============================================================================

// Export everything for external use
export {
  allCommands,
  moderationCommands,
  utilityCommands,
  verificationCommands,
  commandCollection
};
