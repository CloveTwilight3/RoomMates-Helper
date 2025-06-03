/**
 * The Roommates Helper - Main Bot File
 * -----------------------------------
 * Core bot initialization and setup
 * 
 * @license MIT
 * @copyright 2025 Clove Twilight
 */

import { Client, GatewayIntentBits, Events } from 'discord.js';
import dotenv from 'dotenv';

// Import our systems
import { setupDatabase } from './database';
import { setupCommands } from './commands';
import { setupSystems } from './systems';
import { setupLogging } from './utils';
import { writeHealthStatus } from '../healthcheck'; // Keep healthcheck in root for Docker

// Load environment variables
dotenv.config();

//=============================================================================
// CONFIGURATION
//=============================================================================

const BOT_NAME = "The Roommates Helper";
const SERVER_NAME = "Roommates";
const TOKEN = process.env.DISCORD_TOKEN!;

if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN not found in environment variables');
  process.exit(1);
}

// Track bot startup time
const startTime = Date.now();

//=============================================================================
// CLIENT SETUP
//=============================================================================

// Create Discord client with all required intents
const client = new Client({
  intents: [
    // Base intents
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    
    // Message-related intents - REQUIRED for message logging
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    
    // DM intents for verification system
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions
  ]
});

//=============================================================================
// BOT INITIALIZATION
//=============================================================================

/**
 * Initialize all bot systems
 */
async function initializeBot(): Promise<void> {
  try {
    console.log(`🚀 Starting ${BOT_NAME}...`);
    writeHealthStatus('starting', startTime);

    // Initialize in order of dependency
    console.log('🔄 Setting up logging...');
    setupLogging(client);
    
    console.log('🔄 Setting up database...');
    await setupDatabase();
    
    console.log('🔄 Setting up bot systems...');
    await setupSystems(client);
    
    console.log('🔄 Setting up commands...');
    await setupCommands(client);
    
    console.log('✅ All systems initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize bot systems:', error);
    writeHealthStatus('offline', startTime);
    throw error;
  }
}

//=============================================================================
// EVENT HANDLERS
//=============================================================================

/**
 * Bot ready event - fired when bot is logged in and ready
 */
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`🚀 ${BOT_NAME} is online and ready to serve ${SERVER_NAME}!`);
  console.log(`📊 Logged in as ${readyClient.user.tag}`);
  console.log(`🏠 Serving ${readyClient.guilds.cache.size} server(s)`);
  
  // Update health status
  writeHealthStatus('online', startTime);
  
  // Set up a heartbeat interval for health monitoring
  setInterval(() => {
    writeHealthStatus('online', startTime);
  }, 60 * 1000); // Every minute
  
  const initTime = Date.now() - startTime;
  console.log(`⚡ Bot fully initialized in ${initTime}ms`);
});

/**
 * Error event handler
 */
client.on(Events.Error, (error) => {
  console.error('❌ Discord client error:', error);
  writeHealthStatus('offline', startTime);
});

/**
 * Warning event handler
 */
client.on(Events.Warn, (warning) => {
  console.warn('⚠️ Discord client warning:', warning);
});

/**
 * Debug event handler (only in development)
 */
if (process.env.NODE_ENV === 'development') {
  client.on(Events.Debug, (info) => {
    console.log('🔍 Debug:', info);
  });
}

//=============================================================================
// GRACEFUL SHUTDOWN
//=============================================================================

/**
 * Handle graceful shutdown
 */
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  
  try {
    // Update health status
    writeHealthStatus('offline', startTime);
    
    // Destroy the Discord client
    await client.destroy();
    console.log('✅ Discord client destroyed');
    
    // Give a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ Graceful shutdown complete');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  writeHealthStatus('offline', startTime);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  writeHealthStatus('offline', startTime);
});

//=============================================================================
// START THE BOT
//=============================================================================

/**
 * Main bot startup sequence
 */
async function startBot(): Promise<void> {
  try {
    // Initialize all systems
    await initializeBot();
    
    // Login to Discord
    console.log('🔐 Logging in to Discord...');
    await client.login(TOKEN);
    
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    writeHealthStatus('offline', startTime);
    process.exit(1);
  }
}

// Start the bot
startBot();

// Export client for use in other modules if needed
export { client };
