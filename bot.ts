// Zahra Bot - Color Role Assignment Bot with verification system
import { 
  Client, 
  GatewayIntentBits, 
  ActivityType, 
  REST, 
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ComponentType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  Role,
  DiscordAPIError,
  ButtonInteraction,
  Interaction,
  Events
} from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';

// Import the verification system
import { 
  registerVerificationCommands, 
  setupVerificationSystem, 
  handleVerifyCommand, 
  handleModVerifyCommand, 
  handleVerificationButton,
  handleVerificationDecision 
} from './verification';

// Load environment variables from .env file
dotenv.config();

// Bot configuration
const BOT_NAME = "Zahra";
const SERVER_NAME = "Roommates";
const TOKEN = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.CLIENT_ID!;

// Create a new client instance with additional intents for verification
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages, // Added for DM support
  ]
});

// Role management
interface ColorRole {
  id: string;
  name: string;
  hexColor: string;
}

// Store our color roles
let colorRoles: ColorRole[] = [];
let colorCategories: Record<string, ColorRole[]> = {};

// Load color roles from the file
function loadColorRolesFromFile(filePath: string = 'roommates_roles.txt'): void {
  try {
    console.log(`Loading color roles from ${filePath}...`);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');
    
    // Reset the roles array
    colorRoles = [];
    
    // Parse each line in the format [ROLE_NAME, ROLE_ID]
    for (const line of lines) {
      // Skip empty lines
      if (!line.trim()) continue;
      
      // Extract role name and ID
      const match = line.match(/\[(.*?), (\d+)\]/);
      if (match && match.length >= 3) {
        const name = match[1];
        const id = match[2];
        
        // Skip non-color roles (you may need to adjust this logic)
        const skipRoles = [
          '@everyone', 'moderator', 'verified!', 'PluralKit', 'TTS Bot', 
          'carl-bot', 'Captcha.bot', 'Zahra', 'Doughmination System',
          'You have name privileges', 'You\'ve lost name privileges', 
          'MF BOTS ARE ASSHOLES', '18+', 'new role', 'soundboard'
        ];
        
        if (skipRoles.includes(name)) continue;
        
        // Add to our color roles array
        colorRoles.push({
          id,
          name,
          hexColor: '#FFFFFF' // Default color since we don't have the actual hex values
        });
      }
    }
    
    console.log(`Loaded ${colorRoles.length} color roles`);
    
    // Categorize color roles
    categorizeColorRoles();
    
  } catch (error) {
    console.error(`Error loading color roles from ${filePath}:`, error);
  }
}

// Categorize color roles for easier selection
function categorizeColorRoles(): void {
  // Reset categories
  colorCategories = {};
  
  // Create categories based on color names
  const categories = {
    'Red': ['Red', 'Crimson', 'Scarlet', 'Cherry', 'Bean', 'Love', 'Wine', 'Valentine', 'Maroon'],
    'Pink': ['Pink', 'Rose', 'Blush', 'Hot Pink', 'Deep Pink', 'Neon Pink', 'Cadillac Pink', 'Carnation Pink', 'Light Pink', 'Watermelon Pink', 'Pig Pink'],
    'Orange': ['Orange', 'Mango', 'Cantaloupe', 'Coral', 'Light Coral', 'Light Salmon', 'Saffron'],
    'Yellow': ['Yellow', 'Gold', 'Light Yellow', 'Sun Yellow', 'Electric Yellow', 'Lemon', 'Harvest Gold', 'Bright Gold', 'Mustard', 'Champagne', 'Cream', 'Parchment'],
    'Green': ['Green', 'Lime', 'Forest', 'Mint', 'Sage', 'Sea', 'Kelly', 'Avocado', 'Fern', 'Jungle', 'Lawn', 'Chartreuse', 'Dragon', 'Venom', 'Algae', 'Alien', 'Stoplight Go', 'Hummingbird', 'Nebula', 'Hoja', 'Literally Shrek', 'Light Sea Green', 'Medium Sea Green', 'Sea Turtle Green'],
    'Cyan': ['Cyan', 'Teal', 'Aquamarine', 'Light Aquamarine', 'Medium Aquamarine', 'Turquoise', 'Medium Turquoise', 'Light Cyan', 'Dark Turquoise', 'Tiffany Blue', 'Cyan Opaque'],
    'Blue': ['Blue', 'Navy', 'Sky', 'Light Blue', 'Deep Sky Blue', 'Baby Blue', 'Royal Blue', 'Steel Blue', 'Light Steel Blue', 'Powder Blue', 'Alice Blue', 'Dodger Blue', 'Cornflower Blue', 'Medium Blue', 'Midnight Blue', 'Light Sky Blue', 'Day Sky Blue', 'Columbia Blue', 'Jeans Blue', 'Denim Blue', 'Denim Dark Blue', 'Dark Slate Blue', 'Blue Lagoon', 'Blue Jay', 'Blue Angel', 'Blue Eyes', 'Blue Whale', 'Blue Koi', 'Blue Ivy', 'Blue Dress', 'Blue Diamond', 'Blue Zircon', 'Blue Green', 'Blue Gray', 'Blue Hosta', 'Blueberry Blue', 'Electric Blue', 'Cobalt Blue', 'Sapphire Blue', 'Crystal Blue', 'Earth Blue', 'Ocean Blue', 'Windows Blue', 'Pastel Blue', 'Northern Lights Blue', 'Robbin Egg Blue', 'Light Slate Blue', 'Iceberg', 'Butterfly Blue', 'Glacial Blue Ice', 'Silk Blue', 'Lapis Blue', 'Jelly Fish'],
    'Purple': ['Purple', 'Violet', 'Indigo', 'Lavender', 'Plum', 'Mauve', 'Magneta', 'Helitrope Purple', 'Crocus Purple', 'Lovely Purple', 'Purple Flower', 'Purple Iris', 'Purple Mimosa', 'Aztech Purple', 'Purple Ametyhst', 'Tyrian Purple', 'Plum Velvet', 'Lavender Blue'],
    'Gray': ['Gray', 'Light Slate Gray', 'Dark Slate Gray', 'Light Slate', 'Gray Goose', 'Platinum', 'Metallic Silver'],
    'Black & White': ['Black', 'White', 'Night', 'Oil', 'Discord Shadow']
  };
  
  // Function to find which category a role belongs to
  const findCategory = (roleName: string): string => {
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => 
          roleName.toLowerCase().includes(keyword.toLowerCase()))) {
        return category;
      }
    }
    return 'Other';
  };
  
  // Categorize each role
  for (const role of colorRoles) {
    const category = findCategory(role.name);
    
    if (!colorCategories[category]) {
      colorCategories[category] = [];
    }
    
    colorCategories[category].push(role);
  }
  
  // Sort roles alphabetically within each category
  for (const category in colorCategories) {
    colorCategories[category].sort((a, b) => a.name.localeCompare(b.name));
  }
  
  // Log categories
  console.log('Color categories created:');
  for (const [category, roles] of Object.entries(colorCategories)) {
    console.log(`  ${category}: ${roles.length} roles`);
  }
}

// Register slash commands
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
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
      )
      .toJSON()
  ];

  // Add verification commands to the array
  registerVerificationCommands(commands);

  try {
    console.log('Started refreshing application (/) commands.');
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    
    // Check if we have a specific guild ID for development
    const GUILD_ID = process.env.GUILD_ID;
    
    if (GUILD_ID) {
      // Guild commands update instantly
      console.log(`Registering commands to guild: ${GUILD_ID}`);
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands },
      );
      console.log(`Successfully registered commands to guild: ${GUILD_ID}`);
    } else {
      // Global commands can take up to an hour to propagate
      console.log('Registering global commands (this can take up to an hour to propagate)');
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands },
      );
      console.log('Successfully registered global commands.');
    }
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

// When the client is ready, run this code (only once)
client.once('ready', async () => {
  console.log(`${BOT_NAME} is online and ready to serve ${SERVER_NAME}!`);
  
  // Set bot's activity status
  client.user?.setPresence({
    activities: [{ name: `Helping ${SERVER_NAME}`, type: ActivityType.Playing }],
    status: 'online',
  });
  
  // Load color roles and register commands
  loadColorRolesFromFile();
  await registerCommands();
  
  // Set up the verification system
  setupVerificationSystem(client);
});

// Handle interactions (commands, buttons, modals)
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    handleCommandInteraction(interaction);
  } else if (interaction.isButton()) {
    handleButtonInteraction(interaction);
  } else if (interaction.isModalSubmit()) {
    handleModalInteraction(interaction);
  }
});

// Handle command interactions
async function handleCommandInteraction(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
    return;
  }

  const { commandName } = interaction;

  // Get the member from the interaction
  const member = interaction.guild.members.cache.get(interaction.user.id);
  if (!member) {
    await interaction.reply({ content: 'Could not find you in this server!', ephemeral: true });
    return;
  }

  try {
    switch (commandName) {
      case 'color':
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
          case 'select':
            await handleColorSelectCommand(interaction);
            break;
          case 'remove':
            await handleColorRemoveCommand(interaction, member);
            break;
        }
        break;
      
      case 'verify':
        await handleVerifyCommand(interaction);
        break;
      
      case 'modverify':
        await handleModVerifyCommand(interaction);
        break;
        
      default:
        await interaction.reply({ 
          content: 'Unknown command. Please use a valid command.', 
          ephemeral: true 
        });
    }
  } catch (error) {
    console.error(`Error handling command ${commandName}:`, error);
    
    // Only reply if the interaction hasn't been responded to yet
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ 
        content: 'There was an error executing this command. Please try again later.', 
        ephemeral: true 
      }).catch(err => console.error('Error sending error message:', err));
    }
  }
}

// Handle button interactions
async function handleButtonInteraction(interaction: ButtonInteraction) {
  const customId = interaction.customId;
  
  try {
    // Handle color selection
    if (customId === 'color_category_select' || customId === 'color_select') {
      // These are handled by the collectors in handleColorSelectCommand
      return;
    }
    
    // Handle verification buttons
    if (customId === 'start_verification') {
      await handleVerificationButton(interaction);
    } 
    // Handle verification continue button in DM
    else if (customId.startsWith('verification_continue_')) {
      await handleVerificationContinue(interaction);
    }
    // Handle verification cancel button in DM
    else if (customId.startsWith('verification_cancel_')) {
      await handleVerificationCancel(interaction);
    }
    // Handle verification upload button in DM
    else if (customId.startsWith('verification_upload_')) {
      await handleVerificationUpload(interaction);
    }
    // Handle verification approval/denial
    else if (customId.startsWith('approve_verification_') || customId.startsWith('deny_verification_')) {
      await handleVerificationDecision(interaction);
    }
    else {
      // Unknown button
      await interaction.reply({ 
        content: 'This button interaction is not recognized.', 
        ephemeral: true 
      });
    }
  } catch (error) {
    console.error(`Error handling button interaction ${customId}:`, error);
    
    // Only reply if the interaction hasn't been responded to yet
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ 
        content: 'There was an error processing this button. Please try again later.', 
        ephemeral: true 
      }).catch(err => console.error('Error sending error message:', err));
    }
  }
}

// Handle modal interactions
async function handleModalInteraction(interaction: ModalSubmitInteraction) {
  const customId = interaction.customId;
  
  try {
    // Handle verification modals
    if (customId.startsWith('verification_modal_')) {
      await handleVerificationModal(interaction);
    }
    else {
      // Unknown modal
      await interaction.reply({ 
        content: 'This modal submission is not recognized.', 
        ephemeral: true 
      });
    }
  } catch (error) {
    console.error(`Error handling modal interaction ${customId}:`, error);
    
    // Only reply if the interaction hasn't been responded to yet
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ 
        content: 'There was an error processing this submission. Please try again later.', 
        ephemeral: true 
      }).catch(err => console.error('Error sending error message:', err));
    }
  }
}
