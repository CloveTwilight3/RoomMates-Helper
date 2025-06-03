/**
 * The Roommates Helper - Main Entry Point
 * --------------------------------------
 * This is the main entry point for the bot application.
 * It imports and starts the bot with proper error handling.
 * 
 * @license MIT
 * @copyright 2025 Clove Twilight
 */

// Import the main bot file
import './bot';

// Handle any unhandled rejections at the top level
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process for unhandled rejections, just log them
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Exit the process for uncaught exceptions as they indicate a serious problem
  process.exit(1);
});

console.log('🚀 The Roommates Helper is starting...');
