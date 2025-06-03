/**
 * Verification Commands for The Roommates Helper
 * ---------------------------------------------
 * Commands for age verification system management (Updated)
 */

import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ChannelType
} from 'discord.js';
import { BotCommand } from '../../types';
import { 
  createSuccessEmbed, 
  createErrorEmbed, 
  createInfoEmbed,
  logWithEmoji
} from '../../utils';
import { 
  setVerificationChannel, 
  setAgeUnverifiedRole, 
  getVerificationConfig 
} from '../../systems/verification/config';

//=============================================================================
// VERIFY COMMAND
//=============================================================================

const verifyCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Start the age verification process or create verification prompt')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,
    
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server!',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    try {
      // Create the verification button
      const verifyButton = new ButtonBuilder()
        .setCustomId('start_verification')
        .setLabel('Verify My Age')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔞');
      
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(verifyButton);
      
      // Create verification embed
      const embed = new EmbedBuilder()
        .setTitle('🔞 Age Verification Required')
        .setDescription(
          'This server contains age-restricted content.\n\n' +
          '**To gain access, you must verify that you are 18 years or older** by submitting a photo ID.\n\n' +
          '**What you need:**\n' +
          '• A clear photo of your government-issued ID\n' +
          '• Your date of birth must be clearly visible\n' +
          '• Photo should be well-lit and not blurry\n\n' +
          '**Privacy Notice:**\n' +
          'Your ID will only be viewed by server moderators for verification purposes and will not be stored.\n\n' +
          'Click the button below to start the verification process.'
        )
        .setColor(0xFF0000)
        .setFooter({ 
          text: 'You must be 18+ to access this server',
          iconURL: interaction.guild.iconURL() || undefined
        })
        .setTimestamp();
      
      await interaction.reply({
        embeds: [embed],
        components: [row]
      });
      
      logWithEmoji('info', 
        `Verification prompt created by ${interaction.user.tag} in ${interaction.guild.name}`,
        'Verification'
      );
      
    } catch (error) {
      logWithEmoji('error', `Error in verify command: ${error}`, 'Commands');
      
      const errorEmbed = createErrorEmbed(
        'Error',
        'There was an error setting up the verification process.'
      );
      
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  }
};

//=============================================================================
// MODVERIFY COMMAND
//=============================================================================

const modVerifyCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('modverify')
    .setDescription('Configure verification settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('setchannel')
        .setDescription('Set the channel for verification reviews')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('The channel where verification requests will be sent')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('setrole')
        .setDescription('Set the Age Unverified role for new members')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The role to assign to new unverified members')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check the current verification settings')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Enable the verification system')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable the verification system')
    ) as SlashCommandBuilder,
    
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server!',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    const subcommand = interaction.options.getSubcommand();
    
    try {
      switch (subcommand) {
        case 'setchannel':
          await handleSetChannel(interaction);
          break;
          
        case 'setrole':
          await handleSetRole(interaction);
          break;
          
        case 'status':
          await handleStatus(interaction);
          break;
          
        case 'enable':
          await handleEnable(interaction);
          break;
          
        case 'disable':
          await handleDisable(interaction);
          break;
          
        default:
          await interaction.reply({
            content: 'Unknown subcommand.',
            flags: MessageFlags.Ephemeral
          });
      }
      
    } catch (error) {
      logWithEmoji('error', `Error in modverify command: ${error}`, 'Commands');
      
      const errorEmbed = createErrorEmbed(
        'Error',
        'There was an error updating the verification configuration.'
      );
      
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  }
};

//=============================================================================
// SUBCOMMAND HANDLERS
//=============================================================================

async function handleSetChannel(interaction: ChatInputCommandInteraction): Promise<void> {
  const channel = interaction.options.getChannel('channel')!;
  
  if (channel.type !== ChannelType.GuildText) {
    await interaction.reply({
      content: 'Please select a valid text channel.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  try {
    // Test permissions by sending a test message
    const textChannel = channel as any;
    const testMsg = await textChannel.send({
      content: 'Verification channel set successfully! This is a test message to confirm permissions.',
    });
    
    // If successful, save the configuration
    await setVerificationChannel(interaction.guild!.id, channel.id);
    
    // Delete the test message after 5 seconds
    setTimeout(() => {
      testMsg.delete().catch((e: any) => console.error("Could not delete test message:", e));
    }, 5000);
    
    const successEmbed = createSuccessEmbed(
      'Verification Channel Set',
      `Verification review channel set to ${channel.toString()}\n\nModeration team will receive verification requests in this channel.`
    );
    
    await interaction.reply({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
    
    logWithEmoji('info', 
      `Verification channel set to ${channel.name} by ${interaction.user.tag}`,
      'Verification'
    );
    
  } catch (error) {
    logWithEmoji('error', `Failed to set verification channel: ${error}`, 'Commands');
    
    await interaction.reply({
      content: `I don't have permission to send messages in ${channel.toString()}. Please check my permissions.`,
      flags: MessageFlags.Ephemeral
    });
  }
}

async function handleSetRole(interaction: ChatInputCommandInteraction): Promise<void> {
  const role = interaction.options.getRole('role')!;
  
  try {
    await setAgeUnverifiedRole(interaction.guild!.id, role.id);
    
    const successEmbed = createSuccessEmbed(
      'Age Unverified Role Set',
      `Age Unverified role set to ${role.toString()}\n\nThis role will be assigned to new members until they complete verification.`
    );
    
    await interaction.reply({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
    
    logWithEmoji('info', 
      `Age Unverified role set to ${role.name} by ${interaction.user.tag}`,
      'Verification'
    );
    
  } catch (error) {
    logWithEmoji('error', `Failed to set age unverified role: ${error}`, 'Commands');
    
    await interaction.reply({
      content: 'There was an error setting the Age Unverified role.',
      flags: MessageFlags.Ephemeral
    });
  }
}

async function handleStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const config = await getVerificationConfig(interaction.guild!.id);
    
    const embed = new EmbedBuilder()
      .setTitle('🔞 Verification System Status')
      .setColor(0x0099FF);
    
    if (config) {
      embed.addFields(
        { name: 'System Status', value: config.enabled ? 'Enabled ✅' : 'Disabled ❌', inline: true },
        { 
          name: 'Verification Channel', 
          value: config.mod_channel_id ? `<#${config.mod_channel_id}>` : 'Not configured ❌', 
          inline: true 
        },
        { 
          name: 'Age Unverified Role', 
          value: config.age_unverified_role_id ? `<@&${config.age_unverified_role_id}>` : 'Not configured ❌', 
          inline: true 
        }
      );
    } else {
      embed.setDescription('Verification system is not configured for this server.');
      embed.addFields(
        { name: 'System Status', value: 'Not configured ❌', inline: true },
        { name: 'Verification Channel', value: 'Not configured ❌', inline: true },
        { name: 'Age Unverified Role', value: 'Not configured ❌', inline: true }
      );
    }
    
    embed.setFooter({ text: 'Configure channels and roles using /modverify commands' })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    
  } catch (error) {
    logWithEmoji('error', `Error getting verification status: ${error}`, 'Commands');
    
    await interaction.reply({
      content: 'There was an error retrieving the verification status.',
      flags: MessageFlags.Ephemeral
    });
  }
}

async function handleEnable(interaction: ChatInputCommandInteraction): Promise<void> {
  // TODO: Implement enable functionality
  const enableEmbed = createSuccessEmbed(
    'Verification System Enabled',
    'The age verification system has been enabled for this server.\n\nMake sure to configure the verification channel and age unverified role.'
  );
  
  await interaction.reply({ embeds: [enableEmbed], flags: MessageFlags.Ephemeral });
  
  logWithEmoji('info', 
    `Verification system enabled by ${interaction.user.tag}`,
    'Verification'
  );
}

async function handleDisable(interaction: ChatInputCommandInteraction): Promise<void> {
  // TODO: Implement disable functionality
  const disableEmbed = createErrorEmbed(
    'Verification System Disabled',
    'The age verification system has been disabled for this server.\n\n⚠️ New members will not be prompted to verify their age.'
  );
  
  await interaction.reply({ embeds: [disableEmbed], flags: MessageFlags.Ephemeral });
  
  logWithEmoji('info', 
    `Verification system disabled by ${interaction.user.tag}`,
    'Verification'
  );
}

//=============================================================================
// OTHER VERIFICATION COMMANDS
//=============================================================================

const appealCommand: BotCommand = {
  data: new SlashCommandBuilder()
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
    ) as SlashCommandBuilder,
    
  async execute(interaction: ChatInputCommandInteraction) {
    const type = interaction.options.getString('type')!;
    
    try {
      // TODO: Implement actual appeal system
      
      const embed = createInfoEmbed(
        'Appeal System',
        `You have requested to appeal a ${type.toLowerCase()}.\n\nThe appeal system is currently being set up. Please contact a server administrator directly for now.`
      );
      
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      
      logWithEmoji('info', 
        `Appeal requested by ${interaction.user.tag} for ${type}`,
        'Appeals'
      );
      
    } catch (error) {
      logWithEmoji('error', `Error in appeal command: ${error}`, 'Commands');
      
      const errorEmbed = createErrorEmbed(
        'Error',
        'There was an error processing your appeal request.'
      );
      
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  }
};

const verifyStatusCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('verifystatus')
    .setDescription('Check your verification status') as SlashCommandBuilder,
    
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server!',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    try {
      const member = interaction.guild.members.cache.get(interaction.user.id);
      
      if (!member) {
        await interaction.reply({
          content: 'Could not find your membership in this server.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
      // TODO: Check actual verification status from database/roles
      
      const embed = new EmbedBuilder()
        .setTitle('🔞 Your Verification Status')
        .setColor(0x0099FF)
        .setDescription('Your current verification status in this server.')
        .addFields(
          { name: 'Status', value: 'Checking... 🔄', inline: true },
          { name: 'Access Level', value: 'Checking...', inline: true },
          { name: 'Age Verified', value: 'Checking...', inline: true }
        )
        .setFooter({ text: 'Use the verification button in the verification channel to verify your age' })
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      logWithEmoji('error', `Error in verifystatus command: ${error}`, 'Commands');
      
      const errorEmbed = createErrorEmbed(
        'Error',
        'There was an error checking your verification status.'
      );
      
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  }
};

//=============================================================================
// EXPORTS
//=============================================================================

export const verificationCommands: BotCommand[] = [
  verifyCommand,
  modVerifyCommand,
  appealCommand,
  verifyStatusCommand
];

// Export individual commands for testing or direct use
export {
  verifyCommand,
  modVerifyCommand,
  appealCommand,
  verifyStatusCommand
};
