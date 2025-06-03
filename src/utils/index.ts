/**
 * Utility Functions for The Roommates Helper
 * -----------------------------------------
 * Common utility functions used throughout the bot
 */

import { Client, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { LogLevel, LogMessage, Duration } from '../types';

//=============================================================================
// LOGGING UTILITIES
//=============================================================================

/**
 * Setup logging system for the bot
 */
export function setupLogging(client: Client): void {
  console.log('✅ Logging system initialized');
  // This will be expanded when we move the discord-logger system
}

/**
 * Create a standardized log message
 */
export function createLogMessage(
  level: LogLevel,
  message: string,
  source: string = 'Bot',
  details?: any
): LogMessage {
  return {
    level,
    message,
    source,
    details,
    timestamp: new Date()
  };
}

/**
 * Log with emoji prefixes for better readability
 */
export function logWithEmoji(level: LogLevel, message: string, source?: string): void {
  const prefixes = {
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
    debug: '🔍',
    success: '✅'
  };
  
  const prefix = prefixes[level] || 'ℹ️';
  const sourceText = source ? `[${source}]` : '';
  
  console.log(`${prefix} ${sourceText} ${message}`);
}

//=============================================================================
// DURATION UTILITIES
//=============================================================================

/**
 * Parse a duration string (e.g., "1h", "30m", "1d") into milliseconds
 */
export function parseDuration(durationStr: string): Duration {
  const regex = /^(\d+)([smhdw])$/i;
  const match = durationStr.match(regex);
  
  if (!match) {
    return { milliseconds: 0, humanReadable: 'Invalid duration' };
  }
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  let milliseconds = 0;
  
  switch (unit) {
    case 's': milliseconds = value * 1000; break;
    case 'm': milliseconds = value * 60 * 1000; break;
    case 'h': milliseconds = value * 60 * 60 * 1000; break;
    case 'd': milliseconds = value * 24 * 60 * 60 * 1000; break;
    case 'w': milliseconds = value * 7 * 24 * 60 * 60 * 1000; break;
  }
  
  return {
    milliseconds,
    humanReadable: formatDuration(milliseconds)
  };
}

/**
 * Format milliseconds into a human-readable duration string
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds <= 0) return '0 seconds';
  
  const seconds = Math.floor(milliseconds / 1000);
  
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
// EMBED UTILITIES
//=============================================================================

/**
 * Create a standardized error embed
 */
export function createErrorEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setColor(0xFF0000)
    .setTimestamp();
}

/**
 * Create a standardized success embed
 */
export function createSuccessEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setColor(0x00FF00)
    .setTimestamp();
}

/**
 * Create a standardized warning embed
 */
export function createWarningEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`⚠️ ${title}`)
    .setDescription(description)
    .setColor(0xFFCC00)
    .setTimestamp();
}

/**
 * Create a standardized info embed
 */
export function createInfoEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`ℹ️ ${title}`)
    .setDescription(description)
    .setColor(0x5865F2)
    .setTimestamp();
}

//=============================================================================
// PERMISSION UTILITIES
//=============================================================================

/**
 * Check if a user has specific permissions
 */
export function hasPermissions(member: any, permissions: bigint[]): boolean {
  if (!member || !member.permissions) return false;
  
  return permissions.every(permission => 
    member.permissions.has(permission)
  );
}

/**
 * Check if a user is a moderator (has moderate members permission)
 */
export function isModerator(member: any): boolean {
  return hasPermissions(member, [PermissionFlagsBits.ModerateMembers]);
}

/**
 * Check if a user is an administrator
 */
export function isAdministrator(member: any): boolean {
  return hasPermissions(member, [PermissionFlagsBits.Administrator]);
}

/**
 * Check if a user can manage roles
 */
export function canManageRoles(member: any): boolean {
  return hasPermissions(member, [PermissionFlagsBits.ManageRoles]);
}

//=============================================================================
// STRING UTILITIES
//=============================================================================

/**
 * Truncate a string to a maximum length
 */
export function truncateString(str: string, maxLength: number, suffix: string = '...'): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Capitalize the first letter of a string
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert a string to title case
 */
export function toTitleCase(str: string): string {
  return str.toLowerCase().split(' ').map(capitalize).join(' ');
}

/**
 * Escape Discord markdown in a string
 */
export function escapeMarkdown(str: string): string {
  return str.replace(/[*_`~|\\]/g, '\\$&');
}

//=============================================================================
// ARRAY UTILITIES
//=============================================================================

/**
 * Chunk an array into smaller arrays of specified size
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Get a random element from an array
 */
export function getRandomElement<T>(array: T[]): T | undefined {
  if (array.length === 0) return undefined;
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

//=============================================================================
// VALIDATION UTILITIES
//=============================================================================

/**
 * Check if a string is a valid Discord snowflake (ID)
 */
export function isValidSnowflake(id: string): boolean {
  return /^\d{17,19}$/.test(id);
}

/**
 * Check if a string is a valid hex color
 */
export function isValidHexColor(color: string): boolean {
  return /^#?[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Check if a URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

//=============================================================================
// ASYNC UTILITIES
//=============================================================================

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
  
  throw lastError!;
}

//=============================================================================
// ERROR HANDLING UTILITIES
//=============================================================================

/**
 * Safely execute an async function and log errors
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  context: string = 'Unknown'
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    logWithEmoji('error', `Error in ${context}: ${error}`, 'SafeExecute');
    return null;
  }
}

/**
 * Create a timeout promise that rejects after specified time
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  
  return Promise.race([promise, timeout]);
}
