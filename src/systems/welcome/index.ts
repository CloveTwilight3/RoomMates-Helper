/**
 * Welcome System for The Roommates Helper
 * --------------------------------------
 * Manages welcome messages and new member processing
 */

import { Client, Events, GuildMember } from 'discord.js';
import { BotSystem } from '../../types';
import { logWithEmoji } from '../../utils';
import { sendWelcomeDM } from './welcome-dm';

export const welcomeSystem: BotSystem = {
  name: 'Welcome',
  enabled: true,
  
  setup: async (client: Client) => {
    logWithEmoji('info', 'Setting up welcome system...', 'Welcome');
    
    // Set up member join handler
    client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
      try {
        await sendWelcomeDM(member);
      } catch (error) {
        logWithEmoji('error', `Error sending welcome DM: ${error}`, 'Welcome');
      }
    });
    
    logWithEmoji('success', 'Welcome system initialized', 'Welcome');
  },
  
  cleanup: async () => {
    logWithEmoji('info', 'Cleaning up welcome system...', 'Welcome');
  }
};

export * from './welcome-dm';
