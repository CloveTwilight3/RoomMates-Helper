/**
 * Logging System for The Roommates Helper
 * --------------------------------------
 * Manages message logging and audit trails
 */

import { Client } from 'discord.js';
import { BotSystem } from '../../types';
import { logWithEmoji } from '../../utils';
import { setupMessageLogger, registerMessageLoggerCommands } from './message-logger';

export const loggingSystem: BotSystem = {
  name: 'Logging',
  enabled: true,
  
  setup: async (client: Client) => {
    logWithEmoji('info', 'Setting up logging system...', 'Logging');
    
    // Set up message logger
    setupMessageLogger(client);
    
    logWithEmoji('success', 'Logging system initialized', 'Logging');
  },
  
  cleanup: async () => {
    logWithEmoji('info', 'Cleaning up logging system...', 'Logging');
  }
};

export * from './message-logger';
