// verification.ts - Implement age verification system for Helper
import { 
  Client, 
  ButtonInteraction,
  CommandInteraction,
  SlashCommandBuilder,
  ButtonStyle,
  ButtonBuilder,
  ActionRowBuilder,
  EmbedBuilder,
  TextChannel,
  Message,
  GuildMember,
  PermissionFlagsBits,
  ComponentType,
  ChannelType,
  DMChannel,
  Collection,
  Interaction,
  AttachmentBuilder,
  Events,
  Attachment,
  MessageComponentInteraction,
  Guild,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  MessagePayload,
  MessageCreateOptions,
  InteractionResponse,
  MessageFlags
} from 'discord.js';
import fs from 'fs';

// Define the structure for pending verifications
interface PendingVerification {
  userId: string;
  guildId: string;
  timestamp: number;
  messageId?: string; // ID of the message in the mod channel
  attachmentUrl?: string; // URL of the attachment (for modal submissions)
  dmChannelId?: string; // DM channel ID for follow-up messages
  step: 'initiated' | 'awaiting_upload' | 'reviewing' | 'completed' // Track verification step
}

// Update the config interface for typing
interface VerificationConfig {
  MOD_CHANNEL_ID?: string;
  AGE_UNVERIFIED_ROLE_ID?: string;
}

// Cache for pending verifications
const pendingVerifications = new Map<string, PendingVerification>();

// Constants
const VERIFICATION_TIMEOUT = 24 * 60 * 60 * 1000; // 15 minutes
const APPROVAL_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

// Configuration options - use let to allow changing it at runtime
let MOD_CHANNEL_ID = process.env.MOD_CHANNEL_ID;
const VERIFICATION_ROLE_ID = '1344892607255547944'; // 18+ role ID
// Add this new line
let AGE_UNVERIFIED_ROLE_ID = process.env.AGE_UNVERIFIED_ROLE_ID;
const CONFIG_FILE = 'verification_config.json';

// Function to load verification config - Now exported
export function loadVerificationConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) as VerificationConfig;
      if (configData.MOD_CHANNEL_ID) {
        MOD_CHANNEL_ID = configData.MOD_CHANNEL_ID;
        console.log(`Loaded verification channel ID: ${MOD_CHANNEL_ID}`);
      }
      if (configData.AGE_UNVERIFIED_ROLE_ID) {
        AGE_UNVERIFIED_ROLE_ID = configData.AGE_UNVERIFIED_ROLE_ID;
        console.log(`Loaded Age Unverified role ID: ${AGE_UNVERIFIED_ROLE_ID}`);
      }
    }
  } catch (error) {
    console.error("Error loading verification config:", error);
  }
}

// Function to save verification config
function saveVerificationConfig(channelId: string, unverifiedRoleId?: string) {
  try {
    // Load existing config first
    let configData: VerificationConfig = {};
    if (fs.existsSync(CONFIG_FILE)) {
      configData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
    
    // Update values
    configData.MOD_CHANNEL_ID = channelId;
    MOD_CHANNEL_ID = channelId;
    console.log(`Saved verification channel ID: ${MOD_CHANNEL_ID}`);
    
    // Only update unverified role ID if provided
    if (unverifiedRoleId) {
      configData.AGE_UNVERIFIED_ROLE_ID = unverifiedRoleId;
      AGE_UNVERIFIED_ROLE_ID = unverifiedRoleId;
      console.log(`Saved Age Unverified role ID: ${AGE_UNVERIFIED_ROLE_ID}`);
    }
    
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configData, null, 2));
  } catch (error) {
    console.error("Error saving verification config:", error);
    throw error;
  }
}

// Add a getter function for the unverified role ID
export function getAgeUnverifiedRoleId(): string | undefined {
  return AGE_UNVERIFIED_ROLE_ID;
}

/**
 * Register verification-related commands
 */
export function registerVerificationCommands(commandsArray: any[]) {
  const verifyCommand = new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Start the age verification process')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Only admins can create the button
    .toJSON();

  // Add a modverify command for configuration
  const modVerifyCommand = new SlashCommandBuilder()
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
    .toJSON();

  commandsArray.push(verifyCommand, modVerifyCommand);
}

/**
 * Set up event handlers for verification system
 */
export function setupVerificationSystem(client: Client) {
  // Load verification config at startup
  loadVerificationConfig();
  
  // Check for expired verification requests periodically
  setInterval(() => {
    const now = Date.now();
    
    pendingVerifications.forEach((verification, userId) => {
      if (now - verification.timestamp > VERIFICATION_TIMEOUT) {
        pendingVerifications.delete(userId);
        // Try to notify the user that their verification request expired
        notifyVerificationExpired(client, userId);
      }
    });
  }, 5 * 60 * 1000); // Check every 5 minutes
  
  // Listen for messages in DM channels as a fallback for users who can't use buttons
  client.on(Events.MessageCreate, async (message) => {
    // Ignore messages from bots or non-DM channels
    if (message.author.bot || message.channel.type !== ChannelType.DM) return;
    
    // Check if the user has a pending verification
    const userId = message.author.id;
    const verification = pendingVerifications.get(userId);
    
    if (!verification || verification.step !== 'awaiting_upload') return;
    
    // Check if the message contains an image attachment
    const attachment = message.attachments.first();
    if (!attachment) {
      try {
        // Send upload buttons instead of just a message
        await sendVerificationUploadOptions(message.channel as DMChannel, userId, verification);
      } catch (error) {
        console.error("Error sending DM response:", error);
      }
      return;
    }
    
    // Check if the attachment is an image
    const isImage = attachment.contentType?.startsWith('image/');
    
    if (!isImage) {
      try {
        await message.reply({
          content: "Only image attachments are accepted. Please send a photo ID that clearly shows your date of birth.",
        });
      } catch (error) {
        console.error("Error sending DM response:", error);
      }
      return;
    }
    
    // Forward the verification to moderators
    try {
      // Update verification state
      verification.step = 'reviewing';
      
      await forwardVerificationToMods(client, message, attachment, verification);
      
      // Let the user know their verification has been submitted
      const confirmEmbed = new EmbedBuilder()
        .setTitle('Verification Submitted')
        .setDescription('Your verification has been submitted to our moderators for review. You\'ll be notified when a decision has been made.')
        .setColor(0x0099FF)
        .setTimestamp();
      
      await message.reply({
        embeds: [confirmEmbed]
      });
      
      // Update timestamp to prevent timeout during review
      verification.timestamp = Date.now();
    } catch (error) {
      console.error("Error processing verification:", error);
      try {
        await message.reply({
          content: "Sorry, there was an error processing your verification. Please try again later or contact a server administrator.",
        });
      } catch (dmError) {
        console.error("Error sending DM error message:", dmError);
      }
    }
  });
}

/**
 * Notify a user that their verification request has expired
 */
async function notifyVerificationExpired(client: Client, userId: string) {
  try {
    const user = await client.users.fetch(userId);
    await user.send({
      content: "Your verification request has expired. If you still wish to verify, please start the process again in the server."
    });
  } catch (error) {
    console.error(`Could not notify user ${userId} about expired verification:`, error);
  }
}

/**
 * Handle the /verify command
 */
export async function handleVerifyCommand(interaction: CommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server!', flags: MessageFlags.Ephemeral });
    return;
  }
  
  try {
    // Create the verification button
    const verifyButton = new ButtonBuilder()
      .setCustomId('start_verification')
      .setLabel('Verify My Age')
      .setStyle(ButtonStyle.Primary);
    
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(verifyButton);
    
    // Create an embed for the verification message
    const embed = new EmbedBuilder()
      .setTitle('Age Verification Required')
      .setDescription(
        'This server contains age-restricted content.\n\n' +
        'To gain access, you must verify that you are 18 years or older by submitting a photo ID.\n\n' +
        'Click the button below to start the verification process.'
      )
      .setColor(0xFF0000); // Red color for importance
    
    await interaction.reply({
      embeds: [embed],
      components: [row]
    });
  } catch (error) {
    console.error("Error creating verification prompt:", error);
    await interaction.reply({ 
      content: 'There was an error setting up the verification process. Please try again later.',
      flags: MessageFlags.Ephemeral 
    });
  }
}

/**
 * Handle the /modverify command
 */
export async function handleModVerifyCommand(interaction: CommandInteraction) {
  if (!interaction.isChatInputCommand()) return;
  
  const subcommand = interaction.options.getSubcommand();
  
  if (subcommand === 'setchannel') {
    const channel = interaction.options.getChannel('channel');
    
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: 'Please select a valid text channel.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    // Save the channel ID to the config file
    try {
      // Send a test message to confirm permissions
      const testMsg = await (channel as TextChannel).send({
        content: 'Verification channel set successfully! This is a test message to confirm permissions.',
      });
      
      // If the message was sent successfully, save the config
      saveVerificationConfig(channel.id);
      
      // Delete the test message after 5 seconds
      setTimeout(() => {
        testMsg.delete().catch(e => console.error("Could not delete test message:", e));
      }, 5000);
      
      await interaction.reply({
        content: `Verification review channel set to ${channel.toString()}`,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error("Failed to send test message to channel:", error);
      await interaction.reply({
        content: `I don't have permission to send messages in ${channel.toString()}. Please check my permissions.`,
        flags: MessageFlags.Ephemeral
      });
    }
  } 
  else if (subcommand === 'setrole') {
    const role = interaction.options.getRole('role');
    
    if (!role) {
      await interaction.reply({
        content: 'Please select a valid role.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    // Save the role ID to the config file
    try {
      saveVerificationConfig(MOD_CHANNEL_ID || '', role.id);
      
      await interaction.reply({
        content: `Age Unverified role set to ${role.toString()}. This role will be assigned to new members.`,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error("Failed to save role configuration:", error);
      await interaction.reply({
        content: `There was an error setting the Age Unverified role.`,
        flags: MessageFlags.Ephemeral
      });
    }
  } 
  else if (subcommand === 'status') {
    // Update to show both channel and role configuration
    try {
      let statusMessage = '';
      
      // Check channel status
      if (MOD_CHANNEL_ID) {
        try {
          const channel = await interaction.client.channels.fetch(MOD_CHANNEL_ID);
          statusMessage += `Current verification channel: ${channel ? channel.toString() : 'Unknown (ID: ' + MOD_CHANNEL_ID + ')'}\n`;
        } catch (error) {
          statusMessage += `Current verification channel ID is set to: ${MOD_CHANNEL_ID}, but I couldn't fetch the channel. It may have been deleted.\n`;
        }
      } else {
        statusMessage += 'No verification channel has been set. Use `/modverify setchannel` to set one.\n';
      }
      
      // Check role status
      if (AGE_UNVERIFIED_ROLE_ID) {
        try {
          const guild = interaction.guild;
          if (guild) {
            const role = guild.roles.cache.get(AGE_UNVERIFIED_ROLE_ID);
            statusMessage += `Current Age Unverified role: ${role ? role.toString() : 'Unknown (ID: ' + AGE_UNVERIFIED_ROLE_ID + ')'}\n`;
          } else {
            statusMessage += `Current Age Unverified role ID is set to: ${AGE_UNVERIFIED_ROLE_ID}\n`;
          }
        } catch (error) {
          statusMessage += `Current Age Unverified role ID is set to: ${AGE_UNVERIFIED_ROLE_ID}, but I couldn't fetch the role.\n`;
        }
      } else {
        statusMessage += 'No Age Unverified role has been set. Use `/modverify setrole` to set one.\n';
      }
      
      await interaction.reply({
        content: statusMessage,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error("Error displaying status:", error);
      await interaction.reply({
        content: `There was an error retrieving the current configuration.`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
}

/**
 * Handle the verification button click
 */
export async function handleVerificationButton(interaction: ButtonInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ 
      content: 'This button can only be used in a server!', 
      flags: MessageFlags.Ephemeral 
    });
    return;
  }
  
  try {
    const userId = interaction.user.id;
    
    // Check if the user is already being verified
    if (pendingVerifications.has(userId)) {
      const verification = pendingVerifications.get(userId)!;
      
      // If they're in the awaiting_upload step, send them the upload options
      if (verification.step === 'awaiting_upload' && verification.dmChannelId) {
        try {
          const dmChannel = await interaction.client.channels.fetch(verification.dmChannelId) as DMChannel;
          await sendVerificationUploadOptions(dmChannel, userId, verification);
          
          await interaction.reply({
            content: 'You already have a verification in progress. Please check your DMs for instructions.',
            flags: MessageFlags.Ephemeral
          });
        } catch (err) {
          console.error("Error sending upload options:", err);
          await interaction.reply({
            content: 'There was an issue with your existing verification. Starting a new one...',
            flags: MessageFlags.Ephemeral
          });
          
          // Delete old verification and continue
          pendingVerifications.delete(userId);
        }
      } else {
        await interaction.reply({
          content: 'You already have a verification in progress. Please check your DMs.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    }
    
    // Create a new pending verification
    const dmChannel = await interaction.user.createDM();
    
    pendingVerifications.set(userId, {
      userId: userId,
      guildId: interaction.guild.id,
      timestamp: Date.now(),
      dmChannelId: dmChannel.id,
      step: 'initiated'
    });
    
    // Send initial verification info with buttons
    try {
      const embed = new EmbedBuilder()
        .setTitle('Age Verification')
        .setDescription(
          'To verify your age, you need to provide a photo of a valid ID that clearly shows your date of birth.\n\n' +
          'Acceptable forms of ID include:\n' +
          '• Driver\'s License\n' +
          '• Passport\n' +
          '• Government-issued ID card\n\n' +
          'Your ID will only be viewed by server moderators for verification purposes and will not be stored.\n\n' +
          'You have 15 minutes to complete this verification.'
        )
        .setColor(0x0099FF);
      
      // Create the button row
      const continueButton = new ButtonBuilder()
        .setCustomId(`verification_continue_${userId}`)
        .setLabel('Continue')
        .setStyle(ButtonStyle.Primary);
      
      const cancelButton = new ButtonBuilder()
        .setCustomId(`verification_cancel_${userId}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);
      
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(continueButton, cancelButton);
      
      // Send the message
      await dmChannel.send({
        embeds: [embed],
        components: [row]
      });
      
      // Update verification state
      pendingVerifications.get(userId)!.step = 'awaiting_upload';
      
      // Reply to the interaction
      await interaction.reply({
        content: 'I\'ve sent you a DM with instructions for verification. Please check your direct messages.',
        flags: MessageFlags.Ephemeral
      });
    } catch (dmError) {
      // User likely has DMs closed
      console.error("Failed to send DM:", dmError);
      pendingVerifications.delete(userId);
      
      await interaction.reply({
        content: 'I couldn\'t send you a DM. Please enable direct messages from server members and try again.',
        flags: MessageFlags.Ephemeral
      });
    }
  } catch (error) {
    console.error("Error starting verification:", error);
    await interaction.reply({
      content: 'Sorry, there was an error starting the verification process. Please try again later.',
      flags: MessageFlags.Ephemeral
    });
  }
}

/**
 * Handle the continue button in the DM
 */
export async function handleVerificationContinue(interaction: ButtonInteraction) {
  // Verify that this is a DM channel
  if (interaction.channel?.type !== ChannelType.DM) {
    await interaction.reply({ content: 'This button can only be used in DMs.', flags: MessageFlags.Ephemeral });
    return;
  }
  
  const customId = interaction.customId;
  const userId = customId.split('_').pop();
  
  if (!userId || userId !== interaction.user.id) {
    await interaction.reply({ content: 'This button is not for you.', flags: MessageFlags.Ephemeral });
    return;
  }
  
  const verification = pendingVerifications.get(userId);
  if (!verification || verification.step !== 'awaiting_upload') {
    await interaction.reply({ content: 'Your verification session has expired or is not in the correct state.', flags: MessageFlags.Ephemeral });
    return;
  }
  
  try {
    // Send the upload options
    await sendVerificationUploadOptions(interaction.channel as DMChannel, userId, verification);
    
    // Reply to the interaction
    await interaction.update({
      content: 'Please select an option to upload your ID for verification.',
      components: [] // Remove the buttons
    });
  } catch (error) {
    console.error("Error sending upload options:", error);
    await interaction.reply({
      content: 'There was an error processing your request. Please try again later.',
      flags: MessageFlags.Ephemeral
    });
  }
}

/**
 * Handle the cancel button in the DM
 */
export async function handleVerificationCancel(interaction: ButtonInteraction) {
  // Verify that this is a DM channel
  if (interaction.channel?.type !== ChannelType.DM) {
    await interaction.reply({ content: 'This button can only be used in DMs.', flags: MessageFlags.Ephemeral });
    return;
  }
  
  const customId = interaction.customId;
  const userId = customId.split('_').pop();
  
  if (!userId || userId !== interaction.user.id) {
    await interaction.reply({ content: 'This button is not for you.', flags: MessageFlags.Ephemeral });
    return;
  }
  
  // Remove the verification from pending
  pendingVerifications.delete(userId);
  
  // Reply to the interaction
  await interaction.update({
    content: 'Verification cancelled. You can restart the process from the server anytime.',
    components: [] // Remove the buttons
  });
}

/**
 * Send verification upload options
 */
async function sendVerificationUploadOptions(dmChannel: DMChannel, userId: string, verification: PendingVerification) {
  // Create the upload button
  const uploadButton = new ButtonBuilder()
    .setCustomId(`verification_upload_${userId}`)
    .setLabel('Upload ID Photo')
    .setStyle(ButtonStyle.Primary);
  
  const cancelButton = new ButtonBuilder()
    .setCustomId(`verification_cancel_${userId}`)
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Secondary);
  
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(uploadButton, cancelButton);
  
  // Create guidance embed
  const guidanceEmbed = new EmbedBuilder()
    .setTitle('Upload Your ID')
    .setDescription(
      'Please upload a clear photo of your ID that shows your date of birth.\n\n' +
      'Make sure:\n' +
      '• The date of birth is clearly visible\n' +
      '• The image is well-lit and not blurry\n' +
      '• Only your ID is in the frame\n\n' +
      'You can either click the button below to upload, or simply send the image as a message.'
    )
    .setColor(0x0099FF);
  
  // Send the message
  await dmChannel.send({
    embeds: [guidanceEmbed],
    components: [row]
  });
}

/**
 * Handle the upload button in the DM
 */
export async function handleVerificationUpload(interaction: ButtonInteraction) {
  // Verify that this is a DM channel
  if (interaction.channel?.type !== ChannelType.DM) {
    await interaction.reply({ content: 'This button can only be used in DMs.', flags: MessageFlags.Ephemeral });
    return;
  }
  
  const customId = interaction.customId;
  const userId = customId.split('_').pop();
  
  if (!userId || userId !== interaction.user.id) {
    await interaction.reply({ content: 'This button is not for you.', flags: MessageFlags.Ephemeral });
    return;
  }
  
  const verification = pendingVerifications.get(userId);
  if (!verification || verification.step !== 'awaiting_upload') {
    await interaction.reply({ content: 'Your verification session has expired or is not in the correct state.', flags: MessageFlags.Ephemeral });
    return;
  }
  
  try {
    // Create a modal for file upload
    const modal = new ModalBuilder()
      .setCustomId(`verification_modal_${userId}`)
      .setTitle('Upload ID Photo');
    
    // Add instructions (note: Discord doesn't support file uploads in modals, so we'll have to guide the user)
    const instructionsInput = new TextInputBuilder()
      .setCustomId('instructions')
      .setLabel('Attachment Upload Instructions')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(
        'Unfortunately, Discord doesn\'t allow direct file uploads in modals.\n\n' +
        'Please close this modal and simply send your ID photo as a message in this DM conversation.'
      )
      .setRequired(false);
    
    const instructionsRow = new ActionRowBuilder<TextInputBuilder>()
      .addComponents(instructionsInput);
    
    modal.addComponents(instructionsRow);
    
    // Show the modal
    await interaction.showModal(modal);
  } catch (error) {
    console.error("Error showing modal:", error);
    await interaction.reply({
      content: 'There was an error processing your request. Please upload your ID photo directly as a message instead.',
      flags: MessageFlags.Ephemeral
    });
  }
}

/**
 * Handle the modal submit (this won't be used for file upload, but we need to handle it)
 */
export async function handleVerificationModal(interaction: ModalSubmitInteraction) {
  await interaction.reply({
    content: 'Please upload your ID photo directly as a message in this conversation.',
    flags: MessageFlags.Ephemeral
  });
}

/**
 * Forward verification to the mod channel
 */
async function forwardVerificationToMods(client: Client, message: Message, attachment: Attachment, verification: PendingVerification) {
  // Get the mod channel
  if (!MOD_CHANNEL_ID) {
    throw new Error("Mod channel ID not configured");
  }
  
  const modChannel = await client.channels.fetch(MOD_CHANNEL_ID);
  if (!modChannel || !(modChannel instanceof TextChannel)) {
    throw new Error("Invalid mod channel");
  }
  
  // Get the guild
  const guild = client.guilds.cache.get(verification.guildId);
  if (!guild) {
    throw new Error("Guild not found");
  }
  
  // Get the user's information
  const member = await guild.members.fetch(verification.userId).catch(() => null);
  const user = await client.users.fetch(verification.userId);
  
  // Create the user info embed
  const userEmbed = new EmbedBuilder()
    .setTitle('Age Verification Request')
    .setAuthor({
      name: user.tag,
      iconURL: user.displayAvatarURL()
    })
    .setDescription(`User: <@${user.id}> (${user.id})`)
    .addFields([
      { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: 'Joined Server', value: member ? `<t:${Math.floor(member.joinedTimestamp! / 1000)}:R>` : 'Unknown', inline: true }
    ])
    .setColor(0xFFA500) // Orange for pending
    .setTimestamp();
  
  // Create approval/denial buttons
  const approveButton = new ButtonBuilder()
    .setCustomId(`approve_verification_${user.id}`)
    .setLabel('Approve')
    .setStyle(ButtonStyle.Success);
  
  const denyButton = new ButtonBuilder()
    .setCustomId(`deny_verification_${user.id}`)
    .setLabel('Deny & Ban')
    .setStyle(ButtonStyle.Danger);
  
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(approveButton, denyButton);
  
  // Send the verification to the mod channel
  const modMessage = await modChannel.send({
    content: 'New age verification request:',
    embeds: [userEmbed],
    files: [attachment],
    components: [row]
  });
  
  // Update the verification with the message ID
  verification.messageId = modMessage.id;
}

/**
 * Handle verification approval/denial buttons
 */
export async function handleVerificationDecision(interaction: ButtonInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This button can only be used in a server!', flags: MessageFlags.Ephemeral });
    return;
  }
  
  // Check if user has permission to approve/deny
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
    await interaction.reply({ content: 'You don\'t have permission to make verification decisions.', flags: MessageFlags.Ephemeral });
    return;
  }
  
  const customId = interaction.customId;
  const isApproval = customId.startsWith('approve_verification_');
  const isDenial = customId.startsWith('deny_verification_');
  
  if (!isApproval && !isDenial) {
    return;
  }
  
  // Extract the user ID from the button custom ID
  const userId = customId.split('_').pop();
  if (!userId) {
    await interaction.reply({ content: 'Invalid verification request.', flags: MessageFlags.Ephemeral });
    return;
  }
  
  try {
    // Find the verification in our pending list
    const verification = Array.from(pendingVerifications.values())
      .find(v => v.userId === userId);
    
    if (!verification) {
      await interaction.reply({
        content: 'This verification request has expired or was already handled.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    // Get the user
    const guild = interaction.guild;
    const member = await guild.members.fetch(userId).catch(() => null);
    
    if (!member) {
      await interaction.reply({
        content: 'The user is no longer a member of this server.',
        flags: MessageFlags.Ephemeral
      });
      pendingVerifications.delete(userId);
      return;
    }
    
    // Process the decision
    if (isApproval) {
      await processApproval(interaction, member, verification);
    } else {
      await processDenial(interaction, member, verification);
    }
    
    // Mark verification as completed
    verification.step = 'completed';
    
    // Remove the verification from pending after a short delay
    // (to allow for any follow-up actions)
    setTimeout(() => {
      pendingVerifications.delete(userId);
    }, 30000);
    
    // Disable the buttons
    try {
      const message = await interaction.message.fetch();
      
      // Create a new disabled row instead of trying to convert the existing one
      const disabledButtons = [
        new ButtonBuilder()
          .setCustomId((message.components[0] as any).components[0].customId)
          .setLabel((message.components[0] as any).components[0].label)
          .setStyle((message.components[0] as any).components[0].style)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId((message.components[0] as any).components[1].customId)
          .setLabel((message.components[0] as any).components[1].label)
          .setStyle((message.components[0] as any).components[1].style)
          .setDisabled(true)
      ];
      
      const newRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(disabledButtons);
      
      await interaction.message.edit({ components: [newRow] });
    } catch (error) {
      console.error("Error disabling buttons:", error);
    }
  } catch (error) {
    console.error("Error processing verification decision:", error);
    await interaction.reply({
      content: 'There was an error processing this verification. Please try again or check the logs.',
      flags: MessageFlags.Ephemeral
    });
  }
}

/**
 * Process an approved verification
 */
async function processApproval(interaction: ButtonInteraction, member: GuildMember, verification: PendingVerification) {
  // Add the 18+ role
  await member.roles.add(VERIFICATION_ROLE_ID);
  
  // Remove the Age Unverified role if it exists
  if (AGE_UNVERIFIED_ROLE_ID) {
    try {
      await member.roles.remove(AGE_UNVERIFIED_ROLE_ID);
      console.log(`Removed Age Unverified role from ${member.user.tag}`);
    } catch (error) {
      console.error(`Failed to remove Age Unverified role from ${member.user.tag}:`, error);
    }
  }
  
  // Update the embed to show approval
  const message = interaction.message;
  const embeds = message.embeds;
  
  if (embeds.length > 0) {
    const updatedEmbed = EmbedBuilder.from(embeds[0])
      .setColor(0x00FF00) // Green for approved
      .setTitle('Age Verification Approved')
      .addFields([
        { name: 'Decision', value: `Approved by ${interaction.user.tag}`, inline: true },
        { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
      ]);
    
    await message.edit({ embeds: [updatedEmbed] });
  }
  
  // Notify the user
  try {
    const user = await interaction.client.users.fetch(member.id);
    
    // Create a success embed
    const successEmbed = new EmbedBuilder()
      .setTitle('Verification Approved')
      .setDescription(`Your age verification for **${interaction.guild!.name}** has been approved! You now have access to age-restricted content.`)
      .setColor(0x00FF00)
      .setTimestamp();
    
    await user.send({ embeds: [successEmbed] });
  } catch (error) {
    console.error("Error notifying user of approval:", error);
  }
  
  // Notify the moderator
  await interaction.reply({
    content: `Verification for ${member.user.tag} has been approved. They have been given the 18+ role and had their Age Unverified role removed.`,
    flags: MessageFlags.Ephemeral
  });
}

/**
 * Process a denied verification
 */
async function processDenial(interaction: ButtonInteraction, member: GuildMember, verification: PendingVerification) {
  // Update the embed to show denial
  const message = interaction.message;
  const embeds = message.embeds;
  
  if (embeds.length > 0) {
    const updatedEmbed = EmbedBuilder.from(embeds[0])
      .setColor(0xFF0000) // Red for denied
      .setTitle('Age Verification Denied')
      .addFields([
        { name: 'Decision', value: `Denied by ${interaction.user.tag}`, inline: true },
        { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
        { name: 'Action', value: 'User was banned', inline: true }
      ]);
    
    await message.edit({ embeds: [updatedEmbed] });
  }
  
  // Try to notify the user before ban takes effect
  try {
    const user = await interaction.client.users.fetch(member.id);
    
    // Create a denial embed
    const denialEmbed = new EmbedBuilder()
      .setTitle('Verification Denied')
      .setDescription(`Your age verification for **${interaction.guild!.name}** has been denied. Due to server policies, you have been banned from the server.`)
      .setColor(0xFF0000)
      .setTimestamp();
    
    await user.send({ embeds: [denialEmbed] });
  } catch (error) {
    console.error("Error notifying user of denial:", error);
  }
  
  // Ban the user after the notification has been sent
  try {
    await member.ban({
      reason: `Age verification denied by ${interaction.user.tag}`
    });
    
    // Notify the moderator
    await interaction.reply({
      content: `Verification for ${member.user.tag} has been denied. The user has been banned.`,
      flags: MessageFlags.Ephemeral
    });
  } catch (banError) {
    console.error("Error banning user:", banError);
    await interaction.reply({
      content: `Failed to ban ${member.user.tag}. Please check my permissions and ban them manually.`,
      flags: MessageFlags.Ephemeral
    });
  }
}
