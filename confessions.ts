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
import { randomUUID } from 'crypto';

interface ConfessionData {
    id: string; // UUID for the confession
    userId: string;
    content: string;
    timestamp: number;
    messageId?: string;
}

interface ConfessionStorage {
    nextNumber: number;
    pending: Record<string, ConfessionData>; // messageId -> confession data
}

// Store confession data with persistent storage
let confessionStorage: ConfessionStorage = {
    nextNumber: 1,
    pending: {}
};

const CONFESSIONS_FILE = 'confessions.json';

/**
 * Load confession data from file on startup
 */
function loadConfessionData() {
    try {
        if (require('fs').existsSync(CONFESSIONS_FILE)) {
            const data = require('fs').readFileSync(CONFESSIONS_FILE, 'utf8');
            confessionStorage = JSON.parse(data);
            
            console.log(`✅ Loaded confession data - Next number: ${confessionStorage.nextNumber}, Pending: ${Object.keys(confessionStorage.pending).length}`);
        } else {
            // Create initial file
            saveConfessionData();
            console.log('✅ Created new confession data file');
        }
    } catch (error) {
        console.error('❌ Error loading confession data:', error);
        // Reset to defaults on error
        confessionStorage = { nextNumber: 1, pending: {} };
    }
}

/**
 * Save confession data to file
 */
function saveConfessionData() {
    try {
        require('fs').writeFileSync(CONFESSIONS_FILE, JSON.stringify(confessionStorage, null, 2));
    } catch (error) {
        console.error('❌ Error saving confession data:', error);
    }
}

/**
 * Initialize confession system (call this when bot starts)
 */
function initializeConfessionSystem() {
    loadConfessionData();
    console.log('✅ Confession system initialized');
}

const confessCommand = {
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
        
        // Create confession data with UUID
        const confessionData: ConfessionData = {
            id: randomUUID(),
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

        // Create approval buttons with UUID
        const approveButton = new ButtonBuilder()
            .setCustomId(`approve_${confessionData.id}`)
            .setLabel('✅ Approve')
            .setStyle(ButtonStyle.Success);

        const rejectButton = new ButtonBuilder()
            .setCustomId(`reject_${confessionData.id}`)
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
            confessionStorage.pending[approvalMessage.id] = confessionData;
            
            // Save to file
            saveConfessionData();

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

async function handleConfessionButtons(interaction: ButtonInteraction) {
    const [action, confessionId] = interaction.customId.split('_');
    const messageId = interaction.message.id;
    
    // Get confession data
    const confessionData = confessionStorage.pending[messageId];
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

            // Get current confession number and increment it
            const confessionNumber = confessionStorage.nextNumber;
            confessionStorage.nextNumber++;

            // Create confession embed
            const confessionEmbed = new EmbedBuilder()
                .setTitle(`📝 Anonymous Confession #${confessionNumber}`)
                .setDescription(confessionData.content)
                .setColor(0x5865F2)
                .setTimestamp()
                .setFooter({ text: 'React with 💭 to share your thoughts!' });

            // Post confession
            await confessionChannel.send({ embeds: [confessionEmbed] });

            // Clean up and save
            delete confessionStorage.pending[messageId];
            saveConfessionData();

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
                await originalUser.send(`✅ Your confession has been approved and posted as Confession #${confessionNumber}!`);
            } catch (error) {
                console.log('Could not DM user about approval');
            }

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

            // Clean up and save
            delete confessionStorage.pending[messageId];
            saveConfessionData();

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
export { confessCommand, handleConfessionButtons, initializeConfessionSystem };