/**
 * Message Logger System for The Roommates Helper
 * -----------------------------------------
 * A comprehensive message logging system that tracks message edits,
 * deletions, bulk deletions, and member join/leave events across Discord servers.
 * 
 * @license MIT
 * @copyright 2025 Clove Twilight
 */

//=============================================================================
// IMPORTS
//=============================================================================

import { 
  Client, 
  TextChannel,
  Message,
  PartialMessage,
  EmbedBuilder,
  SlashCommandBuilder,
  CommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  Events,
  GuildTextBasedChannel,
  Collection,
  Attachment,
  AttachmentBuilder,
  Channel,
  GuildChannel,
  GuildMember,
  User,
  PartialGuildMember
} from 'discord.js';
import fs from 'fs';

//=============================================================================
// CONFIGURATION INTERFACES
//=============================================================================

/**
 * Configuration interface for the message logger system
 */
interface MessageLoggerConfig {
  enabled: boolean;
  logChannelId?: string;
  ignoredChannels: string[];
  ignoredUsers: string[];
  logMessageContent: boolean;
  logDMs: boolean;
  logEdits: boolean;
  logDeletes: boolean;
  logJoins: boolean;
  logLeaves: boolean;
  maxMessageLength: number;
}

// Default configuration
const defaultConfig: MessageLoggerConfig = {
  enabled: false,
  logChannelId: undefined,
  ignoredChannels: [],
  ignoredUsers: [],
  logMessageContent: true,
  logDMs: false,
  logEdits: true,
  logDeletes: true,
  logJoins: true,
  logLeaves: true,
  maxMessageLength: 1000 // Maximum message length to log
};

// Current configuration
let loggerConfig: MessageLoggerConfig = { ...defaultConfig };

// File path for configuration
const CONFIG_FILE = 'message_logger_config.json';

//=============================================================================
// CONFIGURATION MANAGEMENT
//=============================================================================

/**
 * Load the message logger configuration from disk
 * @returns The current logger configuration
 */
export function loadMessageLoggerConfig(): MessageLoggerConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      loggerConfig = { ...defaultConfig, ...configData };
      console.log(`Message logger configuration loaded: ${loggerConfig.enabled ? 'Enabled' : 'Disabled'}`);
      console.log(`Loaded logger config. Channel ID: ${loggerConfig.logChannelId}, Enabled: ${loggerConfig.enabled}`);
      
      if (loggerConfig.enabled && !loggerConfig.logChannelId) {
        console.warn('Message logger is enabled but no log channel is configured');
      }
    } else {
      // Create default config file if it doesn't exist
      saveMessageLoggerConfig(loggerConfig);
    }
  } catch (error) {
    console.error("Error loading message logger config:", error);
  }
  
  return loggerConfig;
}

/**
 * Save the message logger configuration to disk
 * @param config Configuration to save
 */
export function saveMessageLoggerConfig(config: MessageLoggerConfig): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    loggerConfig = config;
    console.log(`Message logger configuration saved: ${config.enabled ? 'Enabled' : 'Disabled'}`);
  } catch (error) {
    console.error("Error saving message logger config:", error);
    throw error;
  }
}

//=============================================================================
// COMMAND REGISTRATION
//=============================================================================

/**
 * Register message logger commands
 * @param commandsArray Array to add the commands to
 */
export function registerMessageLoggerCommands(commandsArray: any[]): void {
  const loggerCommand = new SlashCommandBuilder()
    .setName('logger')
    .setDescription('Configure message logging')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('setchannel')
        .setDescription('Set the channel for message logs')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('The channel where message logs will be sent')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Enable message logging')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable message logging')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check the current message logging status')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('toggle')
        .setDescription('Toggle specific logging features')
        .addStringOption(option =>
          option
            .setName('feature')
            .setDescription('The logging feature to toggle')
            .setRequired(true)
            .addChoices(
              { name: 'Message Edits', value: 'edits' },
              { name: 'Message Deletions', value: 'deletes' },
              { name: 'Member Joins', value: 'joins' },
              { name: 'Member Leaves', value: 'leaves' },
              { name: 'Direct Messages', value: 'dms' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('ignore')
        .setDescription('Add a channel or user to the ignore list')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('What to ignore')
            .setRequired(true)
            .addChoices(
              { name: 'Channel', value: 'channel' },
              { name: 'User', value: 'user' }
            )
        )
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('The ID of the channel or user to ignore')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('unignore')
        .setDescription('Remove a channel or user from the ignore list')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('What to unignore')
            .setRequired(true)
            .addChoices(
              { name: 'Channel', value: 'channel' },
              { name: 'User', value: 'user' }
            )
        )
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('The ID of the channel or user to unignore')
            .setRequired(true)
        )
    )
    .toJSON();

  commandsArray.push(loggerCommand);
}

//=============================================================================
// LOGGER SYSTEM SETUP
//=============================================================================

/**
 * Set up the message logger system
 * @param client Discord.js client
 */
export function setupMessageLogger(client: Client): void {
  // Load the configuration
  loadMessageLoggerConfig();
  
  console.log("Setting up message logger with events:");
  console.log("Edit events enabled:", loggerConfig.logEdits);
  console.log("Delete events enabled:", loggerConfig.logDeletes);
  console.log("Join events enabled:", loggerConfig.logJoins);
  console.log("Leave events enabled:", loggerConfig.logLeaves);
  console.log("Log channel ID:", loggerConfig.logChannelId);

  // Set up event listeners for message updates (edits)
  client.on(Events.MessageUpdate, async (oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) => {
    console.log("Message update event triggered");
    console.log(`Message ID: ${newMessage.id}, Channel: ${newMessage.channelId}`);
    
    if (!loggerConfig.enabled || !loggerConfig.logChannelId || !loggerConfig.logEdits) {
      console.log("Message update event ignored - logger not enabled or configured");
      return;
    }
    
    if (newMessage.author?.bot) {
      console.log("Message update event ignored - message from bot");
      return;
    }
    
    // Don't log edits in the log channel itself
    if (newMessage.channelId === loggerConfig.logChannelId) {
      console.log("Message update event ignored - edit in log channel");
      return;
    }
    
    // Debug channel types
    console.log("Message channel type:", newMessage.channel?.type);
    
    // Check if this is a DM - using type casting to avoid TypeScript errors
    const isDM = (newMessage.channel?.type as number) === 1;
    console.log("Is DM channel:", isDM);
    
    if (isDM && !loggerConfig.logDMs) {
      console.log("Message update event ignored - DM logging disabled");
      return;
    }
    
    // Check ignored channels and users
    if (!isDM && loggerConfig.ignoredChannels.includes(newMessage.channelId)) {
      console.log("Message update event ignored - channel is ignored");
      return;
    }
    
    if (newMessage.author && loggerConfig.ignoredUsers.includes(newMessage.author.id)) {
      console.log("Message update event ignored - user is ignored");
      return;
    }
    
    try {
      // Only log if the content has changed and isn't empty
      if (oldMessage.content !== newMessage.content && 
          oldMessage.content !== null && 
          newMessage.content !== null) {
        await logMessageEdit(client, oldMessage, newMessage);
      } else {
        console.log("Message update event ignored - content didn't change or is empty");
      }
    } catch (error) {
      console.error("Error logging message edit:", error);
    }
  });

  // Set up event listeners for message deletions
  client.on(Events.MessageDelete, async (message: Message | PartialMessage) => {
    console.log("Message delete event triggered");
    console.log(`Message ID: ${message.id}, Channel: ${message.channelId}`);
    
    if (!loggerConfig.enabled || !loggerConfig.logChannelId || !loggerConfig.logDeletes) {
      console.log("Message delete event ignored - logger not enabled or configured");
      return;
    }
    
    if (message.author?.bot) {
      console.log("Message delete event ignored - message from bot");
      return;
    }
    
    // Don't log deletions in the log channel itself
    if (message.channelId === loggerConfig.logChannelId) {
      console.log("Message delete event ignored - deletion in log channel");
      return;
    }
    
    // Check if this is a DM - using type casting to avoid TypeScript errors
    const isDM = (message.channel?.type as number) === 1;
    console.log("Is DM channel:", isDM);
    
    if (isDM && !loggerConfig.logDMs) {
      console.log("Message delete event ignored - DM logging disabled");
      return;
    }
    
    // Check ignored channels and users
    if (!isDM && loggerConfig.ignoredChannels.includes(message.channelId)) {
      console.log("Message delete event ignored - channel is ignored");
      return;
    }
    
    if (message.author && loggerConfig.ignoredUsers.includes(message.author.id)) {
      console.log("Message delete event ignored - user is ignored");
      return;
    }
    
    try {
      await logMessageDeletion(client, message);
    } catch (error) {
      console.error("Error logging message deletion:", error);
    }
  });

  // Set up event listeners for bulk message deletions
  client.on(Events.MessageBulkDelete, async (messages, channel) => {
    console.log("Bulk message delete event triggered");
    console.log(`Messages: ${messages.size}, Channel: ${channel.id}`);
    
    if (!loggerConfig.enabled || !loggerConfig.logChannelId || !loggerConfig.logDeletes) {
      console.log("Bulk message delete event ignored - logger not enabled or configured");
      return;
    }
    
    // Don't log deletions in the log channel itself
    if (channel.id === loggerConfig.logChannelId) {
      console.log("Bulk message delete event ignored - deletion in log channel");
      return;
    }
    
    // Check if this is a DM channel - using type casting to avoid TypeScript errors
    const isDM = (channel.type as number) === 1;
    console.log("Is DM channel:", isDM);
    
    if (isDM && !loggerConfig.logDMs) {
      console.log("Bulk message delete event ignored - DM logging disabled");
      return;
    }
    
    // Check ignored channels
    if (!isDM && loggerConfig.ignoredChannels.includes(channel.id)) {
      console.log("Bulk message delete event ignored - channel is ignored");
      return;
    }
    
    try {
      // Create a new Collection to handle messages
      const messageCollection = new Collection<string, Message | PartialMessage>();
      
      // Add each message from the messages collection
      messages.forEach((message, id) => {
        messageCollection.set(id, message);
      });
      
      await logBulkDeletion(client, messageCollection, channel);
    } catch (error) {
      console.error("Error logging bulk deletion:", error);
    }
  });

  // Set up event listeners for member joins
  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    console.log("Member join event triggered");
    console.log(`Member: ${member.user.tag}, Guild: ${member.guild.name}`);
    
    if (!loggerConfig.enabled || !loggerConfig.logChannelId || !loggerConfig.logJoins) {
      console.log("Member join event ignored - logger not enabled or configured");
      return;
    }
    
    // Check if the member is a bot
    if (member.user.bot) {
      console.log("Member join event ignored - member is a bot");
      return;
    }
    
    // Check ignored users
    if (loggerConfig.ignoredUsers.includes(member.id)) {
      console.log("Member join event ignored - user is ignored");
      return;
    }
    
    try {
      await logMemberJoin(client, member);
    } catch (error) {
      console.error("Error logging member join:", error);
    }
  });

  // Set up event listeners for member leaves
  client.on(Events.GuildMemberRemove, async (member: GuildMember | PartialGuildMember) => {
    console.log("Member leave event triggered");
    console.log(`Member: ${member.user.tag}, Guild: ${member.guild.name}`);
    
    if (!loggerConfig.enabled || !loggerConfig.logChannelId || !loggerConfig.logLeaves) {
      console.log("Member leave event ignored - logger not enabled or configured");
      return;
    }
    
    // Check if the member is a bot
    if (member.user.bot) {
      console.log("Member leave event ignored - member is a bot");
      return;
    }
    
    // Check ignored users
    if (loggerConfig.ignoredUsers.includes(member.id)) {
      console.log("Member leave event ignored - user is ignored");
      return;
    }
    
    try {
      await logMemberLeave(client, member);
    } catch (error) {
      console.error("Error logging member leave:", error);
    }
  });
  
  // Check intents
  const intents = client.options.intents;
  console.log("Bot Intents Check:");
  console.log(`- GuildMembers: ${intents.has(1 << 1)}`);
  console.log(`- GuildMessages: ${intents.has(1 << 9)}`);
  console.log(`- GuildMessageReactions: ${intents.has(1 << 10)}`);
  console.log(`- GuildMessageTyping: ${intents.has(1 << 11)}`);
  console.log(`- DirectMessages: ${intents.has(1 << 12)}`);
  console.log(`- MessageContent: ${intents.has(1 << 15)}`);
  
  console.log("Message logger set up successfully");
}

/**
 * Test the logger channel is properly configured
 * @param client Discord.js client
 */
export async function testLoggerChannel(client: Client): Promise<void> {
  if (!loggerConfig.logChannelId) {
    console.log("No log channel ID configured - skipping test");
    return;
  }

  try {
    console.log(`Testing logger channel with ID: ${loggerConfig.logChannelId}`);
    
    const channel = await client.channels.fetch(loggerConfig.logChannelId);
    console.log("Log channel fetch result:", channel ? "Found" : "Not found");
    
    if (!channel) {
      console.log("Could not find log channel");
      return;
    }
    
    if (!('send' in channel)) {
      console.log("Channel doesn't support sending messages");
      return;
    }
    
    const textChannel = channel as TextChannel;
    const testEmbed = new EmbedBuilder()
      .setTitle('Message Logger Test')
      .setDescription('This is a test to verify the message logger is working correctly.')
      .setColor(0x00FF00)
      .addFields({ name: 'Status', value: 'If you can see this message, the logger channel is properly configured.' })
      .setFooter({ text: 'The Roommates Helper' })
      .setTimestamp();
    
    console.log("Sending test message to log channel");
    const sentMessage = await textChannel.send({ embeds: [testEmbed] });
    console.log("Test message sent successfully. ID:", sentMessage.id);
  } catch (error) {
    console.error("Error testing log channel:", error);
  }
}

//=============================================================================
// COMMAND HANDLERS
//=============================================================================

/**
 * Main handler for logger commands
 * @param interaction Command interaction
 */
export async function handleLoggerCommand(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  
  const subcommand = interaction.options.getSubcommand();
  
  switch (subcommand) {
    case 'setchannel':
      await handleSetChannelCommand(interaction);
      break;
    case 'enable':
      await handleEnableCommand(interaction);
      break;
    case 'disable':
      await handleDisableCommand(interaction);
      break;
    case 'status':
      await handleStatusCommand(interaction);
      break;
    case 'toggle':
      await handleToggleCommand(interaction);
      break;
    case 'ignore':
      await handleIgnoreCommand(interaction);
      break;
    case 'unignore':
      await handleUnignoreCommand(interaction);
      break;
  }
}

/**
 * Handle the setchannel subcommand
 * @param interaction Command interaction
 */
async function handleSetChannelCommand(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  
  const selectedChannel = interaction.options.getChannel('channel');
  
  if (!selectedChannel) {
    await interaction.reply({
      content: 'Please select a valid channel.',
      ephemeral: true
    });
    return;
  }
  
  console.log("Selected channel type:", selectedChannel.type);
  
  // Use type casting to avoid TypeScript errors with channel type checks
  if (!selectedChannel || ![0, 5, 10, 11, 12, 15].includes(selectedChannel.type as number)) {
    await interaction.reply({
      content: 'Please select a text channel. Voice channels and categories cannot be used for logging.',
      ephemeral: true
    });
    return;
  }
  
  try {
    // Try to fetch the channel to ensure we have access to it
    console.log("Fetching channel:", selectedChannel.id);
    const channel = await interaction.client.channels.fetch(selectedChannel.id);
    console.log("Channel fetch result:", channel ? "Found" : "Not found");
    
    if (!channel) {
      console.log("Channel not found");
      await interaction.reply({
        content: 'I cannot access that channel.',
        ephemeral: true
      });
      return;
    }
    
    // Make sure it's a text channel
    const textChannel = channel as TextChannel;
    
    // Send a test message to confirm permissions
    console.log("Sending test message to channel");
    const testMsg = await textChannel.send({
      content: 'Message logger channel set successfully! This is a test message to confirm permissions.',
    });
    console.log("Test message sent successfully");
    
    // If the message was sent successfully, save the config
    loggerConfig.logChannelId = selectedChannel.id;
    saveMessageLoggerConfig(loggerConfig);
    
    // Delete the test message after a few seconds
    setTimeout(() => {
      testMsg.delete().catch(e => console.error("Could not delete test message:", e));
    }, 5000);
    
    await interaction.reply({
      content: `Message log channel set to <#${selectedChannel.id}>`,
      ephemeral: true
    });
  } catch (error) {
    console.error("Failed to send test message to channel:", error);
    await interaction.reply({
      content: `I don't have permission to send messages in <#${selectedChannel.id}>. Please check my permissions.`,
      ephemeral: true
    });
  }
}

/**
 * Handle the enable subcommand
 * @param interaction Command interaction
 */
async function handleEnableCommand(interaction: CommandInteraction): Promise<void> {
  if (!loggerConfig.logChannelId) {
    await interaction.reply({
      content: 'No log channel has been set. Please use `/logger setchannel` first.',
      ephemeral: true
    });
    return;
  }
  
  loggerConfig.enabled = true;
  saveMessageLoggerConfig(loggerConfig);
  
  await interaction.reply({
    content: `Message logging has been enabled. Logs will be sent to <#${loggerConfig.logChannelId}>.`,
    ephemeral: true
  });
}

/**
 * Handle the disable subcommand
 * @param interaction Command interaction
 */
async function handleDisableCommand(interaction: CommandInteraction): Promise<void> {
  loggerConfig.enabled = false;
  saveMessageLoggerConfig(loggerConfig);
  
  await interaction.reply({
    content: 'Message logging has been disabled.',
    ephemeral: true
  });
}

/**
 * Handle the toggle subcommand
 * @param interaction Command interaction
 */
async function handleToggleCommand(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  
  const feature = interaction.options.getString('feature', true);
  
  let toggledValue = false;
  let featureName = "";
  
  switch (feature) {
    case 'edits':
      loggerConfig.logEdits = !loggerConfig.logEdits;
      toggledValue = loggerConfig.logEdits;
      featureName = "Message edits logging";
      break;
    case 'deletes':
      loggerConfig.logDeletes = !loggerConfig.logDeletes;
      toggledValue = loggerConfig.logDeletes;
      featureName = "Message deletions logging";
      break;
    case 'joins':
      loggerConfig.logJoins = !loggerConfig.logJoins;
      toggledValue = loggerConfig.logJoins;
      featureName = "Member joins logging";
      break;
    case 'leaves':
      loggerConfig.logLeaves = !loggerConfig.logLeaves;
      toggledValue = loggerConfig.logLeaves;
      featureName = "Member leaves logging";
      break;
    case 'dms':
      loggerConfig.logDMs = !loggerConfig.logDMs;
      toggledValue = loggerConfig.logDMs;
      featureName = "DM logging";
      break;
  }
  
  saveMessageLoggerConfig(loggerConfig);
  
  await interaction.reply({
    content: `${featureName} has been ${toggledValue ? 'enabled' : 'disabled'}.`,
    ephemeral: true
  });
}

/**
 * Handle the status subcommand
 * @param interaction Command interaction
 */
async function handleStatusCommand(interaction: CommandInteraction): Promise<void> {
  let statusMessage = `Message logging is currently ${loggerConfig.enabled ? 'enabled' : 'disabled'}.\n`;
  
  if (loggerConfig.logChannelId) {
    statusMessage += `Log channel: <#${loggerConfig.logChannelId}>\n`;
  } else {
    statusMessage += 'No log channel has been set.\n';
  }
  
  statusMessage += `Message edits logging: ${loggerConfig.logEdits ? 'Enabled' : 'Disabled'}\n`;
  statusMessage += `Message deletions logging: ${loggerConfig.logDeletes ? 'Enabled' : 'Disabled'}\n`;
  statusMessage += `Member joins logging: ${loggerConfig.logJoins ? 'Enabled' : 'Disabled'}\n`;
  statusMessage += `Member leaves logging: ${loggerConfig.logLeaves ? 'Enabled' : 'Disabled'}\n`;
  statusMessage += `DM logging: ${loggerConfig.logDMs ? 'Enabled' : 'Disabled'}\n`;
  
  if (loggerConfig.ignoredChannels.length > 0) {
    statusMessage += '\nIgnored Channels:\n';
    loggerConfig.ignoredChannels.forEach(channelId => {
      statusMessage += `- <#${channelId}>\n`;
    });
  }
  
  if (loggerConfig.ignoredUsers.length > 0) {
    statusMessage += '\nIgnored Users:\n';
    loggerConfig.ignoredUsers.forEach(userId => {
      statusMessage += `- <@${userId}>\n`;
    });
  }
  
  await interaction.reply({
    content: statusMessage,
    ephemeral: true
  });
}

/**
 * Handle the ignore subcommand
 * @param interaction Command interaction
 */
async function handleIgnoreCommand(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  
  const type = interaction.options.getString('type', true);
  const id = interaction.options.getString('id', true);
  
  if (!id.match(/^\d+$/)) {
    await interaction.reply({
      content: 'Please provide a valid ID (numbers only).',
      ephemeral: true
    });
    return;
  }
  
  try {
    if (type === 'channel') {
      // Check if the channel exists
      try {
        const channel = await interaction.client.channels.fetch(id);
        if (!channel) {
          await interaction.reply({
            content: 'That channel does not exist or I cannot access it.',
            ephemeral: true
          });
          return;
        }
      } catch (error) {
        await interaction.reply({
          content: 'That channel does not exist or I cannot access it.',
          ephemeral: true
        });
        return;
      }
      
      // Add to ignored channels if not already there
      if (!loggerConfig.ignoredChannels.includes(id)) {
        loggerConfig.ignoredChannels.push(id);
        saveMessageLoggerConfig(loggerConfig);
        
        await interaction.reply({
          content: `Channel <#${id}> has been added to the ignore list.`,
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: `Channel <#${id}> is already in the ignore list.`,
          ephemeral: true
        });
      }
    } else if (type === 'user') {
      // Check if the user exists
      try {
        const user = await interaction.client.users.fetch(id);
        if (!user) {
          await interaction.reply({
            content: 'That user does not exist or I cannot access them.',
            ephemeral: true
          });
          return;
        }
      } catch (error) {
        await interaction.reply({
          content: 'That user does not exist or I cannot access them.',
          ephemeral: true
        });
        return;
      }
      
      // Add to ignored users if not already there
      if (!loggerConfig.ignoredUsers.includes(id)) {
        loggerConfig.ignoredUsers.push(id);
        saveMessageLoggerConfig(loggerConfig);
        
        await interaction.reply({
          content: `User <@${id}> has been added to the ignore list.`,
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: `User <@${id}> is already in the ignore list.`,
          ephemeral: true
        });
      }
    }
  } catch (error) {
    console.error("Error handling ignore command:", error);
    await interaction.reply({
      content: 'There was an error processing your request.',
      ephemeral: true
    });
  }
}

/**
 * Handle the unignore subcommand
 * @param interaction Command interaction
 */
async function handleUnignoreCommand(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  
  const type = interaction.options.getString('type', true);
  const id = interaction.options.getString('id', true);
  
  if (!id.match(/^\d+$/)) {
    await interaction.reply({
      content: 'Please provide a valid ID (numbers only).',
      ephemeral: true
    });
    return;
  }
  
  try {
    if (type === 'channel') {
      // Remove from ignored channels
      const index = loggerConfig.ignoredChannels.indexOf(id);
      if (index !== -1) {
        loggerConfig.ignoredChannels.splice(index, 1);
        saveMessageLoggerConfig(loggerConfig);
        
        await interaction.reply({
          content: `Channel <#${id}> has been removed from the ignore list.`,
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: `Channel <#${id}> is not in the ignore list.`,
          ephemeral: true
        });
      }
    } else if (type === 'user') {
      // Remove from ignored users
      const index = loggerConfig.ignoredUsers.indexOf(id);
      if (index !== -1) {
        loggerConfig.ignoredUsers.splice(index, 1);
        saveMessageLoggerConfig(loggerConfig);
        
        await interaction.reply({
          content: `User <@${id}> has been removed from the ignore list.`,
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: `User <@${id}> is not in the ignore list.`,
          ephemeral: true
        });
      }
    }
  } catch (error) {
    console.error("Error handling unignore command:", error);
    await interaction.reply({
      content: 'There was an error processing your request.',
      ephemeral: true
    });
  }
}

//=============================================================================
// MESSAGE LOGGING FUNCTIONS
//=============================================================================

/**
 * Log a message edit
 * @param client Discord.js client
 * @param oldMessage Original message
 * @param newMessage Edited message
 */
async function logMessageEdit(
  client: Client, 
  oldMessage: Message | PartialMessage, 
  newMessage: Message | PartialMessage
): Promise<void> {
  console.log("Attempting to log message edit");
  
  if (!loggerConfig.logChannelId) {
    console.log("No log channel configured");
    return;
  }
  
  try {
    console.log("Fetching log channel:", loggerConfig.logChannelId);
    const logChannel = await client.channels.fetch(loggerConfig.logChannelId);
    console.log("Log channel fetch result:", logChannel ? "Found" : "Not found");
    
    if (!logChannel) {
      console.log("Log channel not found");
      return;
    }
    
    // Make sure it's a text channel
    const textChannel = logChannel as TextChannel;
    
    // Check if this is a DM - using type casting to avoid TypeScript errors
    const isDM = (newMessage.channel?.type as number) === 1;
    console.log("Is DM channel:", isDM);
    
    const author = newMessage.author;
    if (!author) {
      console.log("No author found for message");
      return;
    }
    
    const embed = new EmbedBuilder()
      .setAuthor({
        name: author.tag,
        iconURL: author.displayAvatarURL()
      })
      .setTitle('Message Edited')
      .setColor(0xFFA500) // Orange for edits
      .setDescription(
        `**Author:** <@${author.id}> (${author.id})\n` +
        `**Channel:** ${isDM ? 'Direct Message' : `<#${newMessage.channelId}>`}\n` +
        `**Message ID:** ${newMessage.id}\n` +
        `**Edit Time:** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
        `**Original Time:** <t:${Math.floor(newMessage.createdTimestamp! / 1000)}:F>`
      )
      .setTimestamp();
    
    // Add message content if enabled
    if (loggerConfig.logMessageContent) {
      // Before content
      let beforeContent = oldMessage.content || '';
      if (beforeContent.length > loggerConfig.maxMessageLength) {
        beforeContent = beforeContent.substring(0, loggerConfig.maxMessageLength) + '...';
      }
      
      // After content
      let afterContent = newMessage.content || '';
      if (afterContent.length > loggerConfig.maxMessageLength) {
        afterContent = afterContent.substring(0, loggerConfig.maxMessageLength) + '...';
      }
      
      embed.addFields(
        {
          name: 'Before',
          value: beforeContent || '(No content)'
        },
        {
          name: 'After',
          value: afterContent || '(No content)'
        }
      );
    }
    
    if (!isDM && newMessage.guildId) {
      embed.addFields({
        name: 'Jump to Message',
        value: `[Click to view](https://discord.com/channels/${newMessage.guildId}/${newMessage.channelId}/${newMessage.id})`
      });
    }
    
    console.log("Sending log message to channel");
    await textChannel.send({ embeds: [embed] });
    console.log("Log message sent successfully");
  } catch (error) {
    console.error('Error logging message edit:', error);
  }
}

/**
 * Log a message deletion
 * @param client Discord.js client
 * @param message Deleted message
 */
async function logMessageDeletion(client: Client, message: Message | PartialMessage): Promise<void> {
  console.log("Attempting to log message deletion");
  
  if (!loggerConfig.logChannelId) {
    console.log("No log channel configured");
    return;
  }
  
  try {
    console.log("Fetching log channel:", loggerConfig.logChannelId);
    const logChannel = await client.channels.fetch(loggerConfig.logChannelId);
    console.log("Log channel fetch result:", logChannel ? "Found" : "Not found");
    
    if (!logChannel) {
      console.log("Log channel not found");
      return;
    }
    
    // Make sure it's a text channel
    const textChannel = logChannel as TextChannel;
    
    // Check if this is a DM - using type casting to avoid TypeScript errors
    const isDM = (message.channel?.type as number) === 1;
    console.log("Is DM channel:", isDM);
    
    const author = message.author;
    
    // Skip if we can't determine the author (happens with partial messages)
    if (!author) {
      console.log("No author found for message");
      return;
    }
    
    const embed = new EmbedBuilder()
      .setAuthor({
        name: author.tag,
        iconURL: author.displayAvatarURL()
      })
      .setTitle('Message Deleted')
      .setColor(0xFF0000) // Red for deletions
      .setDescription(
        `**Author:** <@${author.id}> (${author.id})\n` +
        `**Channel:** ${isDM ? 'Direct Message' : `<#${message.channelId}>`}\n` +
        `**Message ID:** ${message.id}\n` +
        `**Creation Time:** <t:${Math.floor(message.createdTimestamp! / 1000)}:F>\n` +
        `**Deletion Time:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setTimestamp();
    
    // Add message content if enabled
    if (loggerConfig.logMessageContent && message.content) {
      let content = message.content;
      
      // Truncate long messages
      if (content.length > loggerConfig.maxMessageLength) {
        content = content.substring(0, loggerConfig.maxMessageLength) + '...';
      }
      
      embed.addFields({
        name: 'Content',
        value: content || '(No content)'
      });
    }
    
    // Add attachments if any
    if (message.attachments && message.attachments.size > 0) {
      const attachmentsList = message.attachments.map(a => `[${a.name || 'Attachment'}](${a.url})`).join('\n');
      embed.addFields({
        name: 'Attachments',
        value: attachmentsList
      });
    }
    
    console.log("Sending log message to channel");
    await textChannel.send({ embeds: [embed] });
    console.log("Log message sent successfully");
  } catch (error) {
    console.error('Error logging message deletion:', error);
  }
}

/**
 * Log bulk message deletions
 * @param client Discord.js client
 * @param messages Collection of deleted messages
 * @param channel Channel where messages were deleted
 */
async function logBulkDeletion(
  client: Client,
  messages: Collection<string, Message | PartialMessage>,
  channel: GuildTextBasedChannel
): Promise<void> {
  console.log("Attempting to log bulk message deletion");
  
  if (!loggerConfig.logChannelId) {
    console.log("No log channel configured");
    return;
  }
  
  try {
    console.log("Fetching log channel:", loggerConfig.logChannelId);
    const logChannel = await client.channels.fetch(loggerConfig.logChannelId);
    console.log("Log channel fetch result:", logChannel ? "Found" : "Not found");
    
    if (!logChannel) {
      console.log("Log channel not found");
      return;
    }
    
    // Make sure it's a text channel
    const textChannel = logChannel as TextChannel;
    
    const embed = new EmbedBuilder()
      .setTitle('Bulk Message Deletion')
      .setColor(0xFF0000) // Red for deletions
      .setDescription(
        `**Channel:** <#${channel.id}>\n` +
        `**Message Count:** ${messages.size}\n` +
        `**Deletion Time:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setTimestamp();
    
    console.log("Sending log message to channel");
    await textChannel.send({ embeds: [embed] });
    console.log("Log message sent successfully");
    
    // If content logging is enabled, create a detailed log
    if (loggerConfig.logMessageContent) {
      // Sort messages by timestamp, oldest first
      const sortedMessages = [...messages.values()].sort((a, b) => 
        (a.createdTimestamp || 0) - (b.createdTimestamp || 0)
      );
      
      let logContent = `# Bulk Deletion Log\n\n`;
      logContent += `**Channel:** <#${channel.id}> (${channel.name})\n`;
      logContent += `**Message Count:** ${messages.size}\n`;
      logContent += `**Deletion Time:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n`;
      
      sortedMessages.forEach((msg, index) => {
        if (!msg.author) return;
        
        logContent += `## Message ${index + 1}\n`;
        logContent += `**Author:** ${msg.author.tag} (${msg.author.id})\n`;
        logContent += `**Created:** <t:${Math.floor(msg.createdTimestamp! / 1000)}:F>\n`;
        
        if (msg.content) {
          logContent += `**Content:**\n\`\`\`\n${msg.content}\n\`\`\`\n`;
        } else {
          logContent += `**Content:** (No content)\n`;
        }
        
        if (msg.attachments && msg.attachments.size > 0) {
          logContent += `**Attachments:**\n`;
          msg.attachments.forEach((attachment) => {
            logContent += `- [${attachment.name || 'Attachment'}](${attachment.url})\n`;
          });
        }
        
        logContent += `\n`;
      });
      
      // If the log is too long, split it or send as a file
      if (logContent.length <= 2000) {
        await textChannel.send({ content: logContent });
      } else {
        // Create a buffer for the file
        const buffer = Buffer.from(logContent, 'utf8');
        const attachment = new AttachmentBuilder(buffer, { name: `bulk-deletion-${Date.now()}.txt` });
        
        await textChannel.send({ 
          content: 'Detailed log of bulk deletion:',
          files: [attachment]
        });
      }
    }
  } catch (error) {
    console.error('Error logging bulk deletion:', error);
  }
}

//=============================================================================
// MEMBER JOIN/LEAVE LOGGING FUNCTIONS
//=============================================================================

/**
 * Log a member joining the server
 * @param client Discord.js client
 * @param member The member who joined
 */
async function logMemberJoin(client: Client, member: GuildMember): Promise<void> {
  console.log("Attempting to log member join");
  
  if (!loggerConfig.logChannelId) {
    console.log("No log channel configured");
    return;
  }
  
  try {
    console.log("Fetching log channel:", loggerConfig.logChannelId);
    const logChannel = await client.channels.fetch(loggerConfig.logChannelId);
    console.log("Log channel fetch result:", logChannel ? "Found" : "Not found");
    
    if (!logChannel) {
      console.log("Log channel not found");
      return;
    }
    
    // Make sure it's a text channel
    const textChannel = logChannel as TextChannel;
    
    // Calculate account age
    const accountCreation = member.user.createdTimestamp;
    const accountAgeMs = Date.now() - accountCreation;
    const accountAgeDays = Math.floor(accountAgeMs / (1000 * 60 * 60 * 24));
    
    // Create the embed
    const embed = new EmbedBuilder()
      .setAuthor({
        name: member.user.tag,
        iconURL: member.user.displayAvatarURL()
      })
      .setTitle('Member Joined')
      .setColor(0x00FF00) // Green for joins
      .setDescription(
        `**Member:** <@${member.id}> (${member.id})\n` +
        `**Server:** ${member.guild.name}\n` +
        `**Join Time:** <t:${Math.floor(member.joinedTimestamp! / 1000)}:F>\n` +
        `**Account Created:** <t:${Math.floor(accountCreation / 1000)}:F> (${accountAgeDays} days ago)\n` +
        `**Server Member Count:** ${member.guild.memberCount}`
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .setTimestamp();
    
    // Check if it's a new account (less than 7 days old)
    if (accountAgeDays < 7) {
      embed.addFields({
        name: '⚠️ New Account Warning',
        value: `This account was created only ${accountAgeDays} days ago.`
      });
    }
    
    console.log("Sending log message to channel");
    await textChannel.send({ embeds: [embed] });
    console.log("Log message sent successfully");
  } catch (error) {
    console.error('Error logging member join:', error);
  }
}

/**
 * Log a member leaving the server
 * @param client Discord.js client
 * @param member The member who left
 */
async function logMemberLeave(client: Client, member: GuildMember | PartialGuildMember): Promise<void> {
  console.log("Attempting to log member leave");
  
  if (!loggerConfig.logChannelId) {
    console.log("No log channel configured");
    return;
  }
  
  try {
    console.log("Fetching log channel:", loggerConfig.logChannelId);
    const logChannel = await client.channels.fetch(loggerConfig.logChannelId);
    console.log("Log channel fetch result:", logChannel ? "Found" : "Not found");
    
    if (!logChannel) {
      console.log("Log channel not found");
      return;
    }
    
    // Make sure it's a text channel
    const textChannel = logChannel as TextChannel;
    
    // Calculate time spent in the server
    const joinTimestamp = member.joinedTimestamp;
    if (!joinTimestamp) {
      console.log("No join timestamp available for member");
      
      // Create a basic embed without join time info
      const basicEmbed = new EmbedBuilder()
        .setAuthor({
          name: member.user.tag,
          iconURL: member.user.displayAvatarURL()
        })
        .setTitle('Member Left')
        .setColor(0xFF0000) // Red for leaves
        .setDescription(
          `**Member:** <@${member.id}> (${member.id})\n` +
          `**Server:** ${member.guild.name}\n` +
          `**Leave Time:** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
          `**Server Member Count:** ${member.guild.memberCount}`
        )
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setTimestamp();
      
      await textChannel.send({ embeds: [basicEmbed] });
      return;
    }
    
    const timeInServerMs = Date.now() - joinTimestamp;
    const timeInServerDays = Math.floor(timeInServerMs / (1000 * 60 * 60 * 24));
    const timeInServerHours = Math.floor((timeInServerMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const timeInServerMinutes = Math.floor((timeInServerMs % (1000 * 60 * 60)) / (1000 * 60));
    
    // Format time in server
    let timeInServerString = '';
    if (timeInServerDays > 0) {
      timeInServerString += `${timeInServerDays} days, `;
    }
    if (timeInServerHours > 0 || timeInServerDays > 0) {
      timeInServerString += `${timeInServerHours} hours, `;
    }
    timeInServerString += `${timeInServerMinutes} minutes`;
    
    // Create the embed
    const embed = new EmbedBuilder()
      .setAuthor({
        name: member.user.tag,
        iconURL: member.user.displayAvatarURL()
      })
      .setTitle('Member Left')
      .setColor(0xFF0000) // Red for leaves
      .setDescription(
        `**Member:** <@${member.id}> (${member.id})\n` +
        `**Server:** ${member.guild.name}\n` +
        `**Leave Time:** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
        `**Join Time:** <t:${Math.floor(joinTimestamp / 1000)}:F>\n` +
        `**Time in Server:** ${timeInServerString}\n` +
        `**Server Member Count:** ${member.guild.memberCount}`
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .setTimestamp();
    
    // Check if they were a recent join (less than 1 day)
    if (timeInServerDays < 1) {
      embed.addFields({
        name: '⚠️ Quick Leave',
        value: `This member left after only ${timeInServerString} in the server.`
      });
    }
    
    // Check if they had roles (only available on full GuildMember objects)
    if ('roles' in member && member.roles instanceof Collection) {
      const roles = member.roles.cache.filter(role => role.name !== '@everyone');
      if (roles.size > 0) {
        const roleList = roles.map(role => role.toString()).join(', ');
        embed.addFields({
          name: 'Roles',
          value: roleList
        });
      }
    }
    
    console.log("Sending log message to channel");
    await textChannel.send({ embeds: [embed] });
    console.log("Log message sent successfully");
  } catch (error) {
    console.error('Error logging member leave:', error);
  }
}
