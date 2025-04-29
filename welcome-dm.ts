// welcome-dm.ts - Handles welcome DMs for new server members
import { Client, GuildMember, EmbedBuilder } from 'discord.js';

// Fixed welcome message template
const WELCOME_MESSAGE = `Hello {user}! Welcome to RoomMates!

1️⃣ Verify your age in the #verification channel - This is needed so you access the full server
2️⃣ Get your color roles using /color
3️⃣ Introduce yourself in #introductions

Feel free to reach out to a mod if you need help!
- The RoomMates Staff Team`;

/**
 * Set up the welcome DM system
 */
export function setupWelcomeDM(client: Client): void {
  // Log that the system is initializing
  console.log('Setting up welcome DM system...');
}

/**
 * Send a welcome DM to a new member
 */
export async function sendWelcomeDM(member: GuildMember): Promise<void> {
  try {
    // Format the welcome message
    const formattedMessage = WELCOME_MESSAGE.replace('{user}', member.user.toString());

    // Create an embed for the welcome message
    const welcomeEmbed = new EmbedBuilder()
      .setTitle(`Welcome to RoomMates!`)
      .setDescription(formattedMessage)
      .setColor(0x00AAFF)
      .setThumbnail(member.guild.iconURL() || null)
      .setTimestamp();

    // Send the welcome DM
    await member.user.send({ embeds: [welcomeEmbed] });
    console.log(`Sent welcome DM to ${member.user.tag}`);
  } catch (error) {
    console.error(`Failed to send welcome DM to ${member.user.tag}:`, error);
    // The user likely has DMs disabled, we'll just log and continue
  }
}
