/**
 * The Roommates Helper - Bot Launcher
 * ----------------------------------
 * Simple launcher that starts the main bot from src/
 * 
 * This file stays in the root for Docker compatibility
 * and provides a clean entry point.
 */

// Import the main bot
import './src/bot';

// The main bot logic is now in src/bot.ts
// This file just serves as the entry point for:
// - Docker containers
// - npm scripts
// - Direct execution

console.log('🚀 The Roommates Helper launcher started');
