// confessions.ts
import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    ButtonBuilder, 
    ActionRowBuilder, 
    ButtonStyle,
    ButtonInteraction,
    TextChannel
} from 'discord.js';

interface ConfessionData {
    userId: string;
    content: string;
    timestamp: number;
    messageId?: string;
}

// Store pending confessions (in production, use a database)
const pendingConfessions = new Map<string, ConfessionData>();

export const confessCommand = {
    data: new SlashCommandBuilder()
        .setName('confess')
        .setDescription('Submit an anonymous confession')
        .addStringOption(option =>
            option.setName('confession')
                .setDescription('Your anonymous confession')
                .setRequired(true)
                .setMaxLength(1000)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const confession = interaction.options.getString('confession', true);
        const userId = interaction.user.id;
        
        // Create confession data
        const confessionData: ConfessionData = {
            userId,
            content: confession,
            timestamp: Date.now()
        };

        // Create approval embed
        const approvalEmbed = new EmbedBuilder()
            .setTitle('📩 New Confession Pending Approval')
            .setDescription(`**Content:**\n${confession}`)
            .setColor(0xFFA500)
            .setFooter({ text: `Submitted by ${interaction.user.tag}` })
            .setTimestamp();

        // Create approval buttons
        const approveButton = new ButtonBuilder()
            .setCustomId(`approve_${userId}_${Date.now()}`)
            .setLabel('✅ Approve')
            .setStyle(ButtonStyle.Success);

        const rejectButton = new ButtonBuilder()
            .setCustomId(`reject_${userId}_${Date.now()}`)
            .setLabel('❌ Reject')
            .setStyle(ButtonStyle.Danger);

        const actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(approveButton, rejectButton);

        try {
            // Send to mod approval channel
            const modChannel = interaction.client.channels.cache.get(process.env.MOD_APPROVAL_CHANNEL_ID!) as TextChannel;
            
            if (!modChannel) {
                return interaction.reply({ 
                    content: 'Error: Mod approval channel not found. Please contact an administrator.', 
                    ephemeral: true 
                });
            }

            const approvalMessage = await modChannel.send({
                embeds: [approvalEmbed],
                components: [actionRow]
            });

            // Store confession data with message ID
            confessionData.messageId = approvalMessage.id;
            pendingConfessions.set(approvalMessage.id, confessionData);

            // Confirm submission to user
            await interaction.reply({
                content: '✅ Your confession has been submitted and is pending approval. You will be notified once it\'s reviewed.',
                ephemeral: true
            });

        } catch (error) {
            console.error('Error handling confession:', error);
            await interaction.reply({
                content: 'There was an error submitting your confession. Please try again later.',
                ephemeral: true
            });
        }
    }
};

export async function handleConfessionButtons(interaction: ButtonInteraction) {
    const [action, originalUserId, timestamp] = interaction.customId.split('_');
    const messageId = interaction.message.id;
    
    // Get confession data
    const confessionData = pendingConfessions.get(messageId);
    if (!confessionData) {
        return interaction.reply({
            content: 'Error: Confession data not found.',
            ephemeral: true
        });
    }

    if (action === 'approve') {
        try {
            // Get confession channel
            const confessionChannel = interaction.client.channels.cache.get(process.env.CONFESSION_CHANNEL_ID!) as TextChannel;
            
            if (!confessionChannel) {
                return interaction.reply({
                    content: 'Error: Confession channel not found.',
                    ephemeral: true
                });
            }

            // Get current confession count (you might want to store this in a database)
            const messages = await confessionChannel.messages.fetch({ limit: 100 });
            const confessionCount = messages.filter(msg => 
                msg.author.id === interaction.client.user?.id && 
                msg.embeds.length > 0 && 
                msg.embeds[0].title?.includes('Anonymous Confession')
            ).size + 1;

            // Create confession embed
            const confessionEmbed = new EmbedBuilder()
                .setTitle(`📝 Anonymous Confession #${confessionCount}`)
                .setDescription(confessionData.content)
                .setColor(0x5865F2)
                .setTimestamp()
                .setFooter({ text: 'React with 💭 to share your thoughts!' });

            // Post confession
            await confessionChannel.send({ embeds: [confessionEmbed] });

            // Update approval message
            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setTitle('✅ Confession Approved')
                .setColor(0x00FF00)
                .addFields({ name: 'Approved by', value: interaction.user.tag, inline: true });

            await interaction.update({
                embeds: [updatedEmbed],
                components: []
            });

            // Notify original user
            try {
                const originalUser = await interaction.client.users.fetch(confessionData.userId);
                await originalUser.send(`✅ Your confession has been approved and posted as Confession #${confessionCount}!`);
            } catch (error) {
                console.log('Could not DM user about approval');
            }

            // Clean up
            pendingConfessions.delete(messageId);

        } catch (error) {
            console.error('Error approving confession:', error);
            await interaction.reply({
                content: 'Error approving confession. Please try again.',
                ephemeral: true
            });
        }

    } else if (action === 'reject') {
        try {
            // Update approval message
            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setTitle('❌ Confession Rejected')
                .setColor(0xFF0000)
                .addFields({ name: 'Rejected by', value: interaction.user.tag, inline: true });

            await interaction.update({
                embeds: [updatedEmbed],
                components: []
            });

            // Notify original user
            try {
                const originalUser = await interaction.client.users.fetch(confessionData.userId);
                await originalUser.send('❌ Your confession was not approved. Please ensure it follows server guidelines.');
            } catch (error) {
                console.log('Could not DM user about rejection');
            }

            // Clean up
            pendingConfessions.delete(messageId);

        } catch (error) {
            console.error('Error rejecting confession:', error);
            await interaction.reply({
                content: 'Error rejecting confession. Please try again.',
                ephemeral: true
            });
        }
    }
}

// Export for use in bot.ts
export { confessCommand, handleConfessionButtons };