/**
 * Verification Handlers
 * --------------------
 * Button, modal, and message handlers for the verification system
 */

import { 
  ButtonInteraction, 
  ModalSubmitInteraction, 
  Message, 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  GuildMember,
  MessageFlags
} from 'discord.js';
import { logWithEmoji } from '../../utils';
import { VerificationConfigModel } from '../../database/models/verification';
import { PendingVerification } from './types';
import { grantVerification } from './index';

// Cache for pending verifications
const pendingVerifications = new Map<string, PendingVerification>();

// Constants
const VERIFICATION_TIMEOUT = 15 * 60 * 1000; // 15 minutes

//=============================================================================
// VERIFICATION FLOW HANDLERS
//=============================================================================

/**
 * Handle the main verification button click
 */
export async function handleVerificationButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ 
      content: 'This button can only be used in a server!', 
      flags: MessageFlags.Ephemeral 
    });
    return;
  }
  
  const userId = interaction.user.id;
  const guildId = interaction.guild.id;
  
  try {
    // Check if user already has a pending verification
    if (pendingVerifications.has(userId)) {
      await interaction.reply({
        content: 'You already have a verification in progress. Please check your DMs.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    // Create DM channel
    const dmChannel = await interaction.user.createDM();
    
    // Create pending verification entry
    const verification: PendingVerification = {
      userId,
      guildId,
      timestamp: Date.now(),
      dmChannelId: dmChannel.id,
      step: 'initiated'
    };
    
    pendingVerifications.set(userId, verification);
    
    // Send initial verification message
    const embed = new EmbedBuilder()
      .setTitle('🔞 Age Verification Required')
      .setDescription(
        'To verify your age, you need to provide a photo of a valid ID that clearly shows your date of birth.\n\n' +
        '**Acceptable forms of ID:**\n' +
        '• Driver\'s License\n' +
        '• Passport\n' +
        '• Government-issued ID card\n\n' +
        '**Privacy Notice:**\n' +
        'Your ID will only be viewed by server moderators for verification purposes and will not be stored.\n\n' +
        'You have 15 minutes to complete this verification.'
      )
      .setColor(0x0099FF)
      .setFooter({ text: 'The Roommates Helper Verification System' });
    
    // Create buttons
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
    
    // Send DM
    await dmChannel.send({
      embeds: [embed],
      components: [row]
    });
    
    // Update verification step
    verification.step = 'awaiting_upload';
    
    // Reply to interaction
    await interaction.reply({
      content: 'I\'ve sent you a DM with verification instructions. Please check your direct messages.',
      flags: MessageFlags.Ephemeral
    });
    
    // Set timeout for verification
    setTimeout(() => {
      if (pendingVerifications.has(userId)) {
        pendingVerifications.delete(userId);
        // Notify user of timeout (optional)
        interaction.user.send({
          content: 'Your verification request has expired. Please restart the process if you still wish to verify.'
        }).catch(() => {});
      }
    }, VERIFICATION_TIMEOUT);
    
  } catch (error) {
    logWithEmoji('error', `Error starting verification for ${interaction.user.tag}: ${error}`, 'Verification');
    
    // Clean up
    pendingVerifications.delete(userId);
    
    await interaction.reply({
      content: 'I couldn\'t send you a DM. Please enable direct messages from server members and try again.',
      flags: MessageFlags.Ephemeral
    });
  }
}

/**
 * Handle verification flow buttons (continue, cancel, upload)
 */
export async function handleVerificationFlow(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;
  const userId = customId.split('_').pop();
  
  if (!userId || userId !== interaction.user.id) {
    await interaction.reply({ 
      content: 'This button is not for you.', 
      flags: MessageFlags.Ephemeral 
    });
    return;
  }
  
  const verification = pendingVerifications.get(userId);
  if (!verification) {
    await interaction.reply({ 
      content: 'Your verification session has expired or is not valid.', 
      flags: MessageFlags.Ephemeral 
    });
    return;
  }
  
  if (customId.startsWith('verification_continue_')) {
    await handleVerificationContinue(interaction, verification);
  } else if (customId.startsWith('verification_cancel_')) {
    await handleVerificationCancel(interaction, verification);
  } else if (customId.startsWith('verification_upload_')) {
    await handleVerificationUploadButton(interaction, verification);
  }
}

/**
 * Handle continue button
 */
async function handleVerificationContinue(
  interaction: ButtonInteraction, 
  verification: PendingVerification
): Promise<void> {
  try {
    const embed = new EmbedBuilder()
      .setTitle('📤 Upload Your ID')
      .setDescription(
        'Please upload a clear photo of your ID that shows your date of birth.\n\n' +
        '**Make sure:**\n' +
        '• The date of birth is clearly visible\n' +
        '• The image is well-lit and not blurry\n' +
        '• Only your ID is in the frame\n\n' +
        'You can simply send the image as a message in this conversation.'
      )
      .setColor(0x0099FF);
    
    const cancelButton = new ButtonBuilder()
      .setCustomId(`verification_cancel_${verification.userId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);
    
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(cancelButton);
    
    await interaction.update({
      embeds: [embed],
      components: [row]
    });
    
    // Update verification step
    verification.step = 'awaiting_upload';
    
  } catch (error) {
    logWithEmoji('error', `Error in verification continue: ${error}`, 'Verification');
    await interaction.reply({
      content: 'There was an error processing your request.',
      flags: MessageFlags.Ephemeral
    });
  }
}

/**
 * Handle cancel button
 */
async function handleVerificationCancel(
  interaction: ButtonInteraction, 
  verification: PendingVerification
): Promise<void> {
  // Remove from pending
  pendingVerifications.delete(verification.userId);
  
  await interaction.update({
    content: 'Verification cancelled. You can restart the process from the server anytime.',
    embeds: [],
    components: []
  });
}

/**
 * Handle upload button (for modal-based upload)
 */
async function handleVerificationUploadButton(
  interaction: ButtonInteraction, 
  verification: PendingVerification
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`verification_modal_${verification.userId}`)
    .setTitle('Upload Instructions');
  
  const instructionsInput = new TextInputBuilder()
    .setCustomId('instructions')
    .setLabel('Upload Instructions')
    .setStyle(TextInputStyle.Paragraph)
    .setValue(
      'Unfortunately, Discord doesn\'t allow direct file uploads in modals.\n\n' +
      'Please close this modal and send your ID photo as a message in this DM conversation.'
    )
    .setRequired(false);
  
  const row = new ActionRowBuilder<TextInputBuilder>()
    .addComponents(instructionsInput);
  
  modal.addComponents(row);
  
  await interaction.showModal(modal);
}

//=============================================================================
// MESSAGE HANDLERS
//=============================================================================

/**
 * Handle verification image upload via message
 */
export async function handleVerificationUpload(message: Message): Promise<void> {
  const userId = message.author.id;
  const verification = pendingVerifications.get(userId);
  
  if (!verification || verification.step !== 'awaiting_upload') {
    return;
  }
  
  // Check if message has an image attachment
  const attachment = message.attachments.first();
  if (!attachment) {
    await message.reply({
      content: 'Please send a photo of your ID. Only image attachments are accepted.'
    });
    return;
  }
  
  // Check if attachment is an image
  if (!attachment.contentType?.startsWith('image/')) {
    await message.reply({
      content: 'Only image attachments are accepted. Please send a photo ID that clearly shows your date of birth.'
    });
    return;
  }
  
  try {
    // Update verification step
    verification.step = 'reviewing';
    verification.attachmentUrl = attachment.url;
    verification.timestamp = Date.now(); // Update timestamp to prevent timeout
    
    // Forward to moderators
    await forwardVerificationToMods(message, attachment, verification);
    
    // Confirm submission to user
    const confirmEmbed = new EmbedBuilder()
      .setTitle('✅ Verification Submitted')
      .setDescription('Your verification has been submitted to our moderators for review. You\'ll be notified when a decision has been made.')
      .setColor(0x00FF00)
      .setTimestamp();
    
    await message.reply({
      embeds: [confirmEmbed]
    });
    
  } catch (error) {
    logWithEmoji('error', `Error processing verification upload: ${error}`, 'Verification');
    await message.reply({
      content: 'Sorry, there was an error processing your verification. Please try again later or contact a server administrator.'
    });
  }
}

/**
 * Handle modal submissions
 */
export async function handleVerificationModal(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.reply({
    content: 'Please upload your ID photo directly as a message in this conversation.',
    flags: MessageFlags.Ephemeral
  });
}

//=============================================================================
// MODERATION HANDLERS
//=============================================================================

/**
 * Forward verification to moderator channel
 */
async function forwardVerificationToMods(
  message: Message, 
  attachment: any, 
  verification: PendingVerification
): Promise<void> {
  const config = await VerificationConfigModel.getByGuildId(verification.guildId);
  if (!config || !config.mod_channel_id) {
    throw new Error('Mod channel not configured');
  }
  
  const guild = message.client.guilds.cache.get(verification.guildId);
  if (!guild) {
    throw new Error('Guild not found');
  }
  
  const modChannel = guild.channels.cache.get(config.mod_channel_id);
  if (!modChannel || !modChannel.isTextBased()) {
    throw new Error('Invalid mod channel');
  }
  
  // Get user information
  const member = await guild.members.fetch(verification.userId).catch(() => null);
  const user = message.author;
  
  // Create verification embed
  const embed = new EmbedBuilder()
    .setTitle('🔞 Age Verification Request')
    .setAuthor({
      name: user.tag,
      iconURL: user.displayAvatarURL()
    })
    .setDescription(`**User:** ${user.toString()} (${user.id})`)
    .addFields([
      { 
        name: 'Account Created', 
        value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, 
        inline: true 
      },
      { 
        name: 'Joined Server', 
        value: member ? `<t:${Math.floor(member.joinedTimestamp! / 1000)}:R>` : 'Unknown', 
        inline: true 
      }
    ])
    .setColor(0xFFA500)
    .setTimestamp();
  
  // Create decision buttons
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
  
  // Send to mod channel
  const modMessage = await modChannel.send({
    content: '**New age verification request:**',
    embeds: [embed],
    files: [attachment],
    components: [row]
  });
  
  // Store message ID for later reference
  verification.messageId = modMessage.id;
}

/**
 * Handle verification decision (approve/deny)
 */
export async function handleVerificationDecision(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ 
      content: 'This button can only be used in a server!', 
      flags: MessageFlags.Ephemeral 
    });
    return;
  }
  
  // Check permissions
  if (!interaction.memberPermissions?.has('BanMembers')) {
    await interaction.reply({ 
      content: 'You don\'t have permission to make verification decisions.', 
      flags: MessageFlags.Ephemeral 
    });
    return;
  }
  
  const customId = interaction.customId;
  const isApproval = customId.startsWith('approve_verification_');
  const userId = customId.split('_').pop();
  
  if (!userId) {
    await interaction.reply({ 
      content: 'Invalid verification request.', 
      flags: MessageFlags.Ephemeral 
    });
    return;
  }
  
  try {
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    
    if (!member) {
      await interaction.reply({
        content: 'The user is no longer a member of this server.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    if (isApproval) {
      await processApproval(interaction, member);
    } else {
      await processDenial(interaction, member);
    }
    
    // Clean up pending verification
    pendingVerifications.delete(userId);
    
    // Disable buttons
    await disableVerificationButtons(interaction);
    
  } catch (error) {
    logWithEmoji('error', `Error processing verification decision: ${error}`, 'Verification');
    await interaction.reply({
      content: 'There was an error processing this verification.',
      flags: MessageFlags.Ephemeral
    });
  }
}

/**
 * Process verification approval
 */
async function processApproval(interaction: ButtonInteraction, member: GuildMember): Promise<void> {
  // Grant verification (add/remove appropriate roles)
  const success = await grantVerification(member);
  
  if (!success) {
    await interaction.reply({
      content: 'Failed to grant verification roles. Please check my permissions.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Update embed
  await updateVerificationEmbed(interaction, 'approved');
  
  // Notify user
  try {
    const successEmbed = new EmbedBuilder()
      .setTitle('✅ Verification Approved')
      .setDescription(`Your age verification for **${interaction.guild!.name}** has been approved! You now have access to age-restricted content.`)
      .setColor(0x00FF00)
      .setTimestamp();
    
    await member.user.send({ embeds: [successEmbed] });
  } catch (error) {
    logWithEmoji('error', `Failed to notify user of approval: ${error}`, 'Verification');
  }
  
  await interaction.reply({
    content: `✅ Verification approved for ${member.user.tag}. They have been granted access.`,
    flags: MessageFlags.Ephemeral
  });
}

/**
 * Process verification denial
 */
async function processDenial(interaction: ButtonInteraction, member: GuildMember): Promise<void> {
  // Update embed
  await updateVerificationEmbed(interaction, 'denied');
  
  // Notify user before ban
  try {
    const denialEmbed = new EmbedBuilder()
      .setTitle('❌ Verification Denied')
      .setDescription(`Your age verification for **${interaction.guild!.name}** has been denied. Due to server policies, you have been banned from the server.`)
      .setColor(0xFF0000)
      .setTimestamp();
    
    await member.user.send({ embeds: [denialEmbed] });
  } catch (error) {
    logWithEmoji('error', `Failed to notify user of denial: ${error}`, 'Verification');
  }
  
  // Ban the user
  try {
    await member.ban({
      reason: `Age verification denied by ${interaction.user.tag}`
    });
    
    await interaction.reply({
      content: `❌ Verification denied for ${member.user.tag}. User has been banned.`,
      flags: MessageFlags.Ephemeral
    });
  } catch (banError) {
    logWithEmoji('error', `Failed to ban user: ${banError}`, 'Verification');
    await interaction.reply({
      content: `❌ Verification denied but failed to ban ${member.user.tag}. Please ban manually.`,
      flags: MessageFlags.Ephemeral
    });
  }
}

/**
 * Update verification embed after decision
 */
async function updateVerificationEmbed(
  interaction: ButtonInteraction, 
  decision: 'approved' | 'denied'
): Promise<void> {
  try {
    const message = interaction.message;
    const embed = EmbedBuilder.from(message.embeds[0]);
    
    embed
      .setTitle(`🔞 Age Verification ${decision.charAt(0).toUpperCase() + decision.slice(1)}`)
      .setColor(decision === 'approved' ? 0x00FF00 : 0xFF0000)
      .addFields([
        { 
          name: 'Decision', 
          value: `${decision.charAt(0).toUpperCase() + decision.slice(1)} by ${interaction.user.tag}`, 
          inline: true 
        },
        { 
          name: 'Time', 
          value: `<t:${Math.floor(Date.now() / 1000)}:R>`, 
          inline: true 
        }
      ]);
    
    await message.edit({ embeds: [embed] });
  } catch (error) {
    logWithEmoji('error', `Failed to update verification embed: ${error}`, 'Verification');
  }
}

/**
 * Disable verification buttons after decision
 */
async function disableVerificationButtons(interaction: ButtonInteraction): Promise<void> {
  try {
    const disabledButtons = [
      new ButtonBuilder()
        .setCustomId('approve_verification_disabled')
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('deny_verification_disabled')
        .setLabel('Deny & Ban')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true)
    ];
    
    const newRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(disabledButtons);
    
    await interaction.message.edit({ components: [newRow] });
  } catch (error) {
    logWithEmoji('error', `Failed to disable verification buttons: ${error}`, 'Verification');
  }
}
