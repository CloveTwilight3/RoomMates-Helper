/**
 * Utility Commands for The Roommates Helper
 * ----------------------------------------
 * User-facing utility commands for server management and fun
 */

import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  ActivityType,
  TextChannel
} from 'discord.js';
import { BotCommand } from '../../types';
import { 
  createSuccessEmbed, 
  createErrorEmbed, 
  createInfoEmbed,
  logWithEmoji,
  isValidSnowflake 
} from '../../utils';

//=============================================================================
// COLOR COMMAND
//=============================================================================

const colorCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('color')
    .setDescription('Manage your color role')
    .addSubcommand(subcommand =>
      subcommand
        .setName('select')
        .setDescription('Choose a color role')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove your current color role')
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
    
    if (subcommand === 'select') {
      // TODO: Implement color selection logic
      const embed = createInfoEmbed(
        'Color Selection',
        'Color role selection is coming soon! This will allow you to choose from categorized color roles.'
      );
      
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      
    } else if (subcommand === 'remove') {
      // TODO: Implement color removal logic
      const embed = createSuccessEmbed(
        'Color Removed',
        'Your color role removal feature is coming soon!'
      );
      
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }
};

//=============================================================================
// NSFW COMMAND
//=============================================================================

const nsfwCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('nsfw')
    .setDescription('Toggle your NSFW content access')
    .addBooleanOption(option =>
      option
        .setName('value')
        .setDescription('Enable (true) or disable (false) NSFW access')
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
    
    const nsfwValue = interaction.options.getBoolean('value', true);
    
    // TODO: Implement NSFW role management
    const embed = nsfwValue 
      ? createSuccessEmbed('NSFW Access Enabled', 'You now have access to NSFW content.')
      : createSuccessEmbed('NSFW Access Disabled', 'You no longer have access to NSFW content.');
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    
    logWithEmoji('info', 
      `User ${interaction.user.tag} ${nsfwValue ? 'enabled' : 'disabled'} NSFW access`,
      'NSFW'
    );
  }
};

//=============================================================================
// SERVER INFO COMMAND
//=============================================================================

const serverInfoCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Display information about the current server') as SlashCommandBuilder,
    
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server!',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const guild = interaction.guild;
    
    try {
      // Fetch additional guild data
      const owner = await guild.fetchOwner();
      const createdDate = Math.floor(guild.createdTimestamp / 1000);
      
      // Count channels by type
      const channels = guild.channels.cache;
      const textChannels = channels.filter(c => c.type === 0).size;
      const voiceChannels = channels.filter(c => c.type === 2).size;
      const categories = channels.filter(c => c.type === 4).size;
      
      // Count roles (excluding @everyone)
      const roleCount = guild.roles.cache.size - 1;
      
      // Calculate server boost info
      const boostLevel = guild.premiumTier;
      const boostCount = guild.premiumSubscriptionCount || 0;
      
      // Create the embed
      const embed = new EmbedBuilder()
        .setTitle(`📊 ${guild.name} Server Information`)
        .setColor(0x5865F2)
        .setThumbnail(guild.iconURL({ size: 256 }))
        .addFields(
          {
            name: '👥 Members',
            value: `Total: ${guild.memberCount}\nHumans: ${guild.members.cache.filter(m => !m.user.bot).size}\nBots: ${guild.members.cache.filter(m => m.user.bot).size}`,
            inline: true
          },
          {
            name: '📝 Channels',
            value: `Text: ${textChannels}\nVoice: ${voiceChannels}\nCategories: ${categories}`,
            inline: true
          },
          {
            name: '🎭 Roles',
            value: `${roleCount} roles`,
            inline: true
          },
          {
            name: '👑 Owner',
            value: `${owner.user.tag}`,
            inline: true
          },
          {
            name: '📅 Created',
            value: `<t:${createdDate}:F>\n<t:${createdDate}:R>`,
            inline: true
          },
          {
            name: '🚀 Boost Status',
            value: `Level: ${boostLevel}\nBoosts: ${boostCount}`,
            inline: true
          }
        )
        .setFooter({ 
          text: `Server ID: ${guild.id}`,
          iconURL: guild.iconURL() || undefined
        })
        .setTimestamp();

      // Add server features if any
      if (guild.features.length > 0) {
        const features = guild.features
          .map(feature => feature.toLowerCase().replace(/_/g, ' '))
          .map(feature => feature.charAt(0).toUpperCase() + feature.slice(1))
          .slice(0, 5) // Limit to 5 to avoid embed limits
          .join(', ');
        
        embed.addFields({
          name: '✨ Features',
          value: features + (guild.features.length > 5 ? `... and ${guild.features.length - 5} more` : ''),
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed] });
      
    } catch (error) {
      logWithEmoji('error', `Error in serverinfo command: ${error}`, 'Commands');
      
      const errorEmbed = createErrorEmbed(
        'Error',
        'There was an error retrieving server information.'
      );
      
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  }
};

//=============================================================================
// ECHO COMMAND
//=============================================================================

const echoCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('echo')
    .setDescription('Make the bot send a message')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addStringOption(option => 
      option
        .setName('message')
        .setDescription('The message to send')
        .setRequired(true)
        .setMaxLength(2000)
    )
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('The channel to send the message to (defaults to current channel)')
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
    
    const message = interaction.options.getString('message')!;
    const targetChannel = interaction.options.getChannel('channel');
    
    try {
      // Determine target channel
      let channelToUse = interaction.channel;
      
      if (targetChannel) {
        // Validate channel type
        if (targetChannel.type !== 0) { // GUILD_TEXT
          await interaction.reply({
            content: 'Please select a valid text channel.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }
        
        // Get the actual channel object
        const fetchedChannel = await interaction.guild.channels.fetch(targetChannel.id);
        if (!fetchedChannel?.isTextBased()) {
          await interaction.reply({
            content: 'Could not access the specified channel.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }
        
        channelToUse = fetchedChannel;
      }
      
      if (!channelToUse?.isTextBased()) {
        await interaction.reply({
          content: 'Could not determine a valid channel to send the message to.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
      // Send the echo message
      await (channelToUse as TextChannel).send(message);
      
      // Confirm to the moderator
      const confirmMessage = targetChannel 
        ? `Message sent to ${targetChannel.toString()}.`
        : 'Message sent to this channel.';
      
      await interaction.reply({
        content: confirmMessage,
        flags: MessageFlags.Ephemeral
      });
      
      // Log the action
      logWithEmoji('info', 
        `Echo command used by ${interaction.user.tag} in ${interaction.guild.name}`,
        'Echo'
      );
      
    } catch (error) {
      logWithEmoji('error', `Error in echo command: ${error}`, 'Commands');
      
      await interaction.reply({
        content: 'There was an error sending the message. Please check my permissions.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};

//=============================================================================
// PING COMMAND
//=============================================================================

const pingCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s response time') as SlashCommandBuilder,
    
  async execute(interaction: ChatInputCommandInteraction) {
    const sent = await interaction.reply({ 
      content: 'Pinging...', 
      fetchReply: true 
    });
    
    const roundtripLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const websocketLatency = Math.round(interaction.client.ws.ping);
    
    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .setColor(0x00FF00)
      .addFields(
        { name: 'Roundtrip Latency', value: `${roundtripLatency}ms`, inline: true },
        { name: 'WebSocket Latency', value: `${websocketLatency}ms`, inline: true }
      )
      .setTimestamp();
    
    await interaction.editReply({ content: '', embeds: [embed] });
  }
};

//=============================================================================
// USER INFO COMMAND
//=============================================================================

const userInfoCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Display information about a user')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to get information about (defaults to yourself)')
        .setRequired(false)
    ) as SlashCommandBuilder,
    
  async execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild?.members.cache.get(targetUser.id);
    
    const embed = new EmbedBuilder()
      .setTitle(`👤 ${targetUser.tag}`)
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .setColor(member?.displayColor || 0x5865F2)
      .addFields(
        { name: 'User ID', value: targetUser.id, inline: true },
        { name: 'Account Created', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:F>`, inline: true }
      );
    
    if (member) {
      embed.addFields(
        { name: 'Joined Server', value: `<t:${Math.floor(member.joinedTimestamp! / 1000)}:F>`, inline: true },
        { name: 'Nickname', value: member.nickname || 'None', inline: true }
      );
      
      // Add roles (limit to avoid embed size issues)
      const roles = member.roles.cache
        .filter(role => role.name !== '@everyone')
        .sort((a, b) => b.position - a.position)
        .map(role => role.toString())
        .slice(0, 10);
      
      if (roles.length > 0) {
        embed.addFields({
          name: `Roles (${member.roles.cache.size - 1})`,
          value: roles.join(', ') + (member.roles.cache.size > 11 ? '...' : ''),
          inline: false
        });
      }
    }
    
    await interaction.reply({ embeds: [embed] });
  }
};

//=============================================================================
// EXPORTS
//=============================================================================

export const utilityCommands: BotCommand[] = [
  colorCommand,
  nsfwCommand,
  serverInfoCommand,
  echoCommand,
  pingCommand,
  userInfoCommand
];

// Export individual commands for testing or direct use
export {
  colorCommand,
  nsfwCommand,
  serverInfoCommand,
  echoCommand,
  pingCommand,
  userInfoCommand
};
