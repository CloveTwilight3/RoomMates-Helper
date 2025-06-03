/**
 * Verification System for The Roommates Helper
 * -------------------------------------------
 * Age verification system with ID photo submission and moderation review
 */

import { Client, Events, GuildMember, ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
import { BotSystem } from '../../types';
import { logWithEmoji } from '../../utils';
import { VerificationConfigModel } from '../../database/models/verification';
import { handleVerificationButton, handleVerificationDecision } from './handlers';
import { initializeVerificationConfig } from './config';

//=============================================================================
// VERIFICATION SYSTEM IMPLEMENTATION
//=============================================================================

export const verificationSystem: BotSystem = {
  name: 'Verification',
  enabled: true,
  
  setup: async (client: Client) => {
    logWithEmoji('info', 'Setting up verification system...', 'Verification');
    
    // Initialize configuration
    await initializeVerificationConfig();
    
    // Set up event handlers
    setupVerificationHandlers(client);
    
    // Set up member join handler for auto-role assignment
    setupMemberJoinHandler(client);
    
    logWithEmoji('success', 'Verification system initialized', 'Verification');
  },
  
  cleanup: async () => {
    logWithEmoji('info', 'Cleaning up verification system...', 'Verification');
    // Cleanup if needed
  }
};

//=============================================================================
// EVENT HANDLERS
//=============================================================================

/**
 * Set up verification-related event handlers
 */
function setupVerificationHandlers(client: Client): void {
  // Handle button interactions
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    
    const customId = interaction.customId;
    
    // Handle verification start button
    if (customId === 'start_verification') {
      await handleVerificationButton(interaction);
    }
    
    // Handle verification decision buttons
    if (customId.startsWith('approve_verification_') || customId.startsWith('deny_verification_')) {
      await handleVerificationDecision(interaction);
    }
    
    // Handle verification flow buttons
    if (customId.startsWith('verification_continue_') || 
        customId.startsWith('verification_cancel_') ||
        customId.startsWith('verification_upload_')) {
      // Import and handle verification flow
      const { handleVerificationFlow } = await import('./handlers');
      await handleVerificationFlow(interaction);
    }
  });
  
  // Handle modal submissions
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    
    if (interaction.customId.startsWith('verification_modal_')) {
      const { handleVerificationModal } = await import('./handlers');
      await handleVerificationModal(interaction);
    }
  });
  
  // Handle DM messages for verification uploads
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || message.channel.type !== 1) return; // DM channel type is 1
    
    // Check if user has pending verification
    const { handleVerificationUpload } = await import('./handlers');
    await handleVerificationUpload(message);
  });
}

/**
 * Set up member join handler for auto-role assignment
 */
function setupMemberJoinHandler(client: Client): void {
  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    try {
      logWithEmoji('info', `New member joined: ${member.user.tag}`, 'Verification');
      
      // Get verification config for this guild
      const config = await VerificationConfigModel.getByGuildId(member.guild.id);
      if (!config || !config.enabled) return;
      
      // Array to store roles to assign
      const rolesToAssign: string[] = [];
      
      // Add Age Unverified role if configured
      if (config.age_unverified_role_id) {
        const ageUnverifiedRole = member.guild.roles.cache.get(config.age_unverified_role_id);
        if (ageUnverifiedRole) {
          rolesToAssign.push(config.age_unverified_role_id);
        } else {
          logWithEmoji('error', 
            `Age Unverified role with ID ${config.age_unverified_role_id} not found`,
            'Verification'
          );
        }
      }
      
      // Add NSFW No Access role if configured
      if (config.nsfw_no_access_role_id) {
        const nsfwNoAccessRole = member.guild.roles.cache.get(config.nsfw_no_access_role_id);
        if (nsfwNoAccessRole) {
          rolesToAssign.push(config.nsfw_no_access_role_id);
        } else {
          logWithEmoji('error',
            `NSFW No Access role with ID ${config.nsfw_no_access_role_id} not found`,
            'Verification'
          );
        }
      }
      
      // Assign all roles at once if any are configured
      if (rolesToAssign.length > 0) {
        await member.roles.add(rolesToAssign);
        logWithEmoji('success', 
          `Assigned ${rolesToAssign.length} role(s) to new member: ${member.user.tag}`,
          'Verification'
        );
      }
      
    } catch (error) {
      logWithEmoji('error', `Error processing new member ${member.user.tag}: ${error}`, 'Verification');
    }
  });
}

//=============================================================================
// VERIFICATION UTILITIES
//=============================================================================

/**
 * Check if a user is verified (has 18+ role and no unverified role)
 */
export async function isUserVerified(member: GuildMember): Promise<boolean> {
  const config = await VerificationConfigModel.getByGuildId(member.guild.id);
  if (!config) return false;
  
  // Check if they have the age unverified role (if so, they're not verified)
  if (config.age_unverified_role_id && member.roles.cache.has(config.age_unverified_role_id)) {
    return false;
  }
  
  // Check if they have NSFW access (indicates verification)
  if (config.nsfw_access_role_id && member.roles.cache.has(config.nsfw_access_role_id)) {
    return true;
  }
  
  // If no clear indicators, assume not verified
  return false;
}

/**
 * Grant verification to a user
 */
export async function grantVerification(member: GuildMember): Promise<boolean> {
  try {
    const config = await VerificationConfigModel.getByGuildId(member.guild.id);
    if (!config) return false;
    
    const rolesToAdd: string[] = [];
    const rolesToRemove: string[] = [];
    
    // Add NSFW access role if configured
    if (config.nsfw_access_role_id) {
      rolesToAdd.push(config.nsfw_access_role_id);
    }
    
    // Remove age unverified role if configured
    if (config.age_unverified_role_id && member.roles.cache.has(config.age_unverified_role_id)) {
      rolesToRemove.push(config.age_unverified_role_id);
    }
    
    // Remove NSFW no access role if configured
    if (config.nsfw_no_access_role_id && member.roles.cache.has(config.nsfw_no_access_role_id)) {
      rolesToRemove.push(config.nsfw_no_access_role_id);
    }
    
    // Apply role changes
    if (rolesToAdd.length > 0) {
      await member.roles.add(rolesToAdd);
    }
    
    if (rolesToRemove.length > 0) {
      await member.roles.remove(rolesToRemove);
    }
    
    logWithEmoji('success', 
      `Granted verification to ${member.user.tag}`,
      'Verification'
    );
    
    return true;
  } catch (error) {
    logWithEmoji('error', 
      `Failed to grant verification to ${member.user.tag}: ${error}`,
      'Verification'
    );
    return false;
  }
}

//=============================================================================
// EXPORTS
//=============================================================================

export * from './config';
export * from './handlers';
export * from './types';
