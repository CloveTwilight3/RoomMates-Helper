/**
 * Moderation Commands for The Roommates Helper
 * -------------------------------------------
 * Commands for server moderation including warnings, mutes, bans, and appeals
 */

import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  User,
  GuildMember
} from 'discord.js';
import { BotCommand } from '../../types';
import { 
  createSuccessEmbed, 
  createErrorEmbed, 
  createWarningEmbed,
  createInfoEmbed,
  logWithEmoji,
  parseDuration,
  formatDuration
} from '../../utils';

//=============================================================================
// WARN COMMAND
//=============================================================================

const warnCommand: BotCommand = {
  data: new SlashCommandBuilder()
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
    ) as SlashCommandBuilder,
    
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server!',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    const user = interaction.options.getUser('user')!;
    const reason = interaction.options.getString('reason')!;
    const silent = interaction.options.getBoolean('silent') || false;
    
    // Basic validation
    if (user.bot) {
      await interaction.reply({
        content: 'You cannot warn a bot.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    if (user.id === interaction.user.id) {
      await interaction.reply({
        content: 'You cannot warn yourself.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    try {
      // TODO: Implement actual warning system with database
      // For now, just show success message
      
      logWithEmoji('info', 
        `Warning issued to ${user.tag} by ${interaction.user.tag}: ${reason}`,
        'Moderation'
      );
      
      const embed = createSuccessEmbed(
        'Warning Issued',
        `⚠️ Warning issued to ${user.toString()} for: ${reason}`
      );
      
      await interaction.reply({
        embeds: [embed],
        ephemeral: silent
      });
      
    } catch (error) {
      logWithEmoji('error', `Error in warn command: ${error}`, 'Commands');
      
      const errorEmbed = createErrorEmbed(
        'Error',
        'There was an error issuing the warning.'
      );
      
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  }
};

//=============================================================================
// MUTE COMMAND
//=============================================================================

const muteCommand: BotCommand = {
  data: new SlashCommandBuilder()
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
    ) as SlashCommandBuilder,
    
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server!',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    const user = interaction.options.getUser('user')!;
    const durationStr = interaction.options.getString('duration')!;
    const reason = interaction.options.getString('reason')!;
    
    // Validate user
    if (user.bot) {
      await interaction.reply({
        content: 'You cannot mute a bot.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    if (user.id === interaction.user.id) {
      await interaction.reply({
        content: 'You cannot mute yourself.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    // Parse duration
    const duration = parseDuration(durationStr);
    if (duration.milliseconds <= 0) {
      await interaction.reply({
        content: 'Invalid duration. Please use a format like 1h, 30m, or 1d.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    try {
      // TODO: Implement actual mute system
      // For now, just show success message
      
      logWithEmoji('info', 
        `Mute issued to ${user.tag} by ${interaction.user.tag} for ${duration.humanReadable}: ${reason}`,
        'Moderation'
      );
      
      const embed = createSuccessEmbed(
        'User Muted',
        `🔇 ${user.toString()} has been muted for ${duration.humanReadable}.\nReason: ${reason}`
      );
      
      await interaction.reply({ embeds: [embed] });
      
    } catch (error) {
      logWithEmoji('error', `Error in mute command: ${error}`, 'Commands');
      
      const errorEmbed = createErrorEmbed(
        'Error',
        'There was an error muting the user.'
      );
      
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  }
};

//=============================================================================
// BAN COMMAND
//=============================================================================

const banCommand: BotCommand = {
  data: new SlashCommandBuilder()
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
    ) as SlashCommandBuilder,
    
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server!',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    const user = interaction.options.getUser('user')!;
    const reason = interaction.options.getString('reason')!;
    const allowAppeal = interaction.options.getBoolean('allow_appeal') ?? true;
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0;
    
    // Validate user
    if (user.bot) {
      await interaction.reply({
        content: 'You cannot ban a bot using this command.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    if (user.id === interaction.user.id) {
      await interaction.reply({
        content: 'You cannot ban yourself.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    try {
      // TODO: Implement actual ban system
      // For now, just show success message
      
      logWithEmoji('info', 
        `Ban issued to ${user.tag} by ${interaction.user.tag}: ${reason}`,
        'Moderation'
      );
      
      const embed = createSuccessEmbed(
        'User Banned',
        `🔨 ${user.toString()} has been banned.\nReason: ${reason}${allowAppeal ? '\n\nThis user can appeal their ban.' : ''}`
      );
      
      await interaction.reply({ embeds: [embed] });
      
    } catch (error) {
      logWithEmoji('error', `Error in ban command: ${error}`, 'Commands');
      
      const errorEmbed = createErrorEmbed(
        'Error',
        'There was an error banning the user.'
      );
      
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  }
};

//=============================================================================
// WARNINGS COMMAND
//=============================================================================

const warningsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View warnings for a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => 
      option
        .setName('user')
        .setDescription('The user to check warnings for')
        .setRequired(true)
    ) as SlashCommandBuilder,
    
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server!',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    const user = interaction.options.getUser('user')!;
    
    try {
      // TODO: Implement actual warning lookup from database
      // For now, show placeholder
      
      const embed = new EmbedBuilder()
        .setTitle(`Warnings for ${user.tag}`)
        .setColor(0xFFCC00)
        .setDescription(`${user.toString()} has no warnings on record.`)
        .setThumbnail(user.displayAvatarURL())
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      logWithEmoji('error', `Error in warnings command: ${error}`, 'Commands');
      
      const errorEmbed = createErrorEmbed(
        'Error',
        'There was an error retrieving warnings.'
      );
      
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  }
};

//=============================================================================
// MODCONFIG COMMAND
//=============================================================================

const modConfigCommand: BotCommand = {
  data: new SlashCommandBuilder()
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
        .setName('mutedrole')
        .setDescription('Set the muted role')
        .addRoleOption(option => 
          option
            .setName('role')
            .setDescription('The role to use for muted users')
            .setRequired(true)
        )
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
        case 'status':
          const statusEmbed = createInfoEmbed(
            'Moderation System Configuration',
            'The moderation system is currently **disabled**.\n\nUse `/modconfig enable` to enable it.'
          );
          
          await interaction.reply({ embeds: [statusEmbed], flags: MessageFlags.Ephemeral });
          break;
          
        case 'enable':
          const enableEmbed = createSuccessEmbed(
            'Moderation System Enabled',
            'The moderation system has been enabled for this server.'
          );
          
          await interaction.reply({ embeds: [enableEmbed], flags: MessageFlags.Ephemeral });
          break;
          
        case 'disable':
          const disableEmbed = createWarningEmbed(
            'Moderation System Disabled',
            'The moderation system has been disabled for this server.'
          );
          
          await interaction.reply({ embeds: [disableEmbed], flags: MessageFlags.Ephemeral });
          break;
          
        case 'logchannel':
          const channel = interaction.options.getChannel('channel')!;
          
          const logEmbed = createSuccessEmbed(
            'Log Channel Set',
            `The moderation log channel has been set to ${channel.toString()}.`
          );
          
          await interaction.reply({ embeds: [logEmbed], flags: MessageFlags.Ephemeral });
          break;
          
        case 'mutedrole':
          const role = interaction.options.getRole('role')!;
          
          const roleEmbed = createSuccessEmbed(
            'Muted Role Set',
            `The muted role has been set to ${role.toString()}.`
          );
          
          await interaction.reply({ embeds: [roleEmbed], flags: MessageFlags.Ephemeral });
          break;
          
        default:
          await interaction.reply({
            content: 'Unknown subcommand.',
            flags: MessageFlags.Ephemeral
          });
      }
      
    } catch (error) {
      logWithEmoji('error', `Error in modconfig command: ${error}`, 'Commands');
      
      const errorEmbed = createErrorEmbed(
        'Error',
        'There was an error updating the configuration.'
      );
      
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  }
};

//=============================================================================
// CHECK COMMAND
//=============================================================================

const checkCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('check')
    .setDescription('Check a user\'s moderation history')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => 
      option
        .setName('user')
        .setDescription('The user to check')
        .setRequired(true)
    ) as SlashCommandBuilder,
    
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server!',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    const user = interaction.options.getUser('user')!;
    const member = interaction.guild.members.cache.get(user.id);
    
    try {
      // TODO: Implement actual moderation history lookup
      // For now, show basic user info
      
      const embed = new EmbedBuilder()
        .setTitle(`Moderation History for ${user.tag}`)
        .setColor(0x5865F2)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
          { name: 'User ID', value: user.id, inline: true },
          { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true }
        );
      
      if (member) {
        embed.addFields(
          { name: 'Joined Server', value: `<t:${Math.floor(member.joinedTimestamp! / 1000)}:R>`, inline: true },
          { name: 'Active Warnings', value: '0', inline: true },
          { name: 'Total Infractions', value: '0', inline: true },
          { name: 'Last Infraction', value: 'None', inline: true }
        );
      }
      
      embed.setDescription(`${user.toString()} has no moderation history on record.`);
      embed.setTimestamp();
      
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      
    } catch (error) {
      logWithEmoji('error', `Error in check command: ${error}`, 'Commands');
      
      const errorEmbed = createErrorEmbed(
        'Error',
        'There was an error retrieving the user\'s moderation history.'
      );
      
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  }
};

//=============================================================================
// EXPORTS
//=============================================================================

export const moderationCommands: BotCommand[] = [
  warnCommand,
  muteCommand,
  banCommand,
  warningsCommand,
  modConfigCommand,
  checkCommand
];

// Export individual commands for testing or direct use
export {
  warnCommand,
  muteCommand,
  banCommand,
  warningsCommand,
  modConfigCommand,
  checkCommand
};
