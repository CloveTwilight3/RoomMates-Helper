// Zahra Bot - Color Role Assignment Bot with subcommands
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
  Role
} from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables from .env file
dotenv.config();

// Bot configuration
const BOT_NAME = "Zahra";
const SERVER_NAME = "Roommates";
const TOKEN = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.CLIENT_ID!;

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
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
});

// Handle slash commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guild, user } = interaction;

  if (!guild) {
    await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
    return;
  }

  // Get the member from the interaction
  const member = guild.members.cache.get(user.id);
  if (!member) {
    await interaction.reply({ content: 'Could not find you in this server!', ephemeral: true });
    return;
  }

  if (commandName === 'color') {
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'select':
        await handleColorSelectCommand(interaction);
        break;
      case 'remove':
        await handleColorRemoveCommand(interaction, member);
        break;
    }
  }
});

// Handle the color select subcommand
async function handleColorSelectCommand(interaction: ChatInputCommandInteraction) {
  // Check if we have any color categories
  if (Object.keys(colorCategories).length === 0) {
    await interaction.reply({
      content: 'No color roles found. Please contact a server administrator.',
      ephemeral: true
    });
    return;
  }

  // Create a select menu for color categories
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('color_category_select')
    .setPlaceholder('Choose a color category')
    .addOptions(
      Object.keys(colorCategories)
        .filter(category => colorCategories[category].length > 0)
        .map(category => 
          new StringSelectMenuOptionBuilder()
            .setLabel(category)
            .setDescription(`${colorCategories[category].length} colors available`)
            .setValue(category)
        )
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(selectMenu);

  await interaction.reply({
    content: 'Select a color category:',
    components: [row],
    ephemeral: true
  });

  // Set up a collector for the menu interaction
  const filter = (i: any) => i.user.id === interaction.user.id;
  const collector = interaction.channel?.createMessageComponentCollector({
    filter,
    time: 60000,
    componentType: ComponentType.StringSelect
  });

  collector?.on('collect', async (i) => {
    if (i.customId === 'color_category_select') {
      const selectedCategory = i.values[0];
      await showColorsForCategory(i, selectedCategory);
    }
    else if (i.customId === 'color_select') {
      const roleId = i.values[0];
      await assignColorRole(i, roleId);
    }
  });

  collector?.on('end', async (collected, reason) => {
    if (reason === 'time') {
      await interaction.editReply({
        content: 'Color selection timed out.',
        components: []
      });
    }
  });
}

// Show colors for a specific category
async function showColorsForCategory(interaction: any, category: string) {
  if (!colorCategories[category] || colorCategories[category].length === 0) {
    await interaction.update({
      content: 'No colors available in this category. Please try another one.',
      components: []
    });
    return;
  }

  // Get colors from this category
  const colors = colorCategories[category];
  
  // Discord has a 25-option limit for select menus
  const maxOptionsPerMenu = 25;
  
  // If we have more than 25 colors, we'll need to handle it
  if (colors.length > maxOptionsPerMenu) {
    // For simplicity, just take the first 25 for now
    // In a production bot, you'd implement pagination here
    const colorsToShow = colors.slice(0, maxOptionsPerMenu);
    
    const colorSelect = new StringSelectMenuBuilder()
      .setCustomId('color_select')
      .setPlaceholder(`Choose a color from ${category}`)
      .addOptions(
        colorsToShow.map(color => 
          new StringSelectMenuOptionBuilder()
            .setLabel(color.name)
            .setValue(color.id)
        )
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(colorSelect);

    await interaction.update({
      content: `Select a color from ${category} (showing first ${maxOptionsPerMenu} of ${colors.length}):`,
      components: [row]
    });
  } else {
    const colorSelect = new StringSelectMenuBuilder()
      .setCustomId('color_select')
      .setPlaceholder(`Choose a color from ${category}`)
      .addOptions(
        colors.map(color => 
          new StringSelectMenuOptionBuilder()
            .setLabel(color.name)
            .setValue(color.id)
        )
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(colorSelect);

    await interaction.update({
      content: `Select a color from ${category}:`,
      components: [row]
    });
  }
}

// Assign the selected color role
async function assignColorRole(interaction: any, roleId: string) {
  if (!interaction.guild) {
    await interaction.update({
      content: 'This command can only be used in a server!',
      components: []
    });
    return;
  }

  const member = interaction.guild.members.cache.get(interaction.user.id);
  if (!member) {
    await interaction.update({
      content: 'Could not find you in this server!',
      components: []
    });
    return;
  }

  // Find the role
  const role = interaction.guild.roles.cache.get(roleId);
  if (!role) {
    await interaction.update({
      content: 'Error: Color role not found. Please try again or contact an admin.',
      components: []
    });
    return;
  }

  try {
    // Remove any existing color roles
    await removeExistingColorRoles(member);
    
    // Assign the new role
    await member.roles.add(role);
    
    // Create an embed to show the result
    const embed = new EmbedBuilder()
      .setTitle('Color Changed!')
      .setDescription(`You now have the ${role.name} color!`)
      .setColor(role.color);
    
    await interaction.update({
      content: '',
      embeds: [embed],
      components: []
    });
  } catch (error) {
    console.error('Error assigning color role:', error);
    await interaction.update({
      content: 'There was an error assigning the color role. Please try again later.',
      components: []
    });
  }
}

// Handle the color remove subcommand
async function handleColorRemoveCommand(interaction: ChatInputCommandInteraction, member: any) {
  try {
    const removed = await removeExistingColorRoles(member);
    
    if (removed) {
      await interaction.reply({ 
        content: 'Your color role has been removed!', 
        ephemeral: true 
      });
    } else {
      await interaction.reply({ 
        content: 'You don\'t have any color roles to remove.', 
        ephemeral: true 
      });
    }
  } catch (error) {
    console.error('Error removing color roles:', error);
    await interaction.reply({ 
      content: 'There was an error removing your color roles. Please try again later.', 
      ephemeral: true 
    });
  }
}

// Helper function to remove existing color roles
async function removeExistingColorRoles(member: any) {
  // Get all color role IDs
  const colorRoleIds = new Set<string>();
  colorRoles.forEach(role => {
    colorRoleIds.add(role.id);
  });
  
  // Filter member's roles to find color roles
  const colorRolesToRemove = member.roles.cache.filter((role: Role) => colorRoleIds.has(role.id));
  
  if (colorRolesToRemove.size === 0) {
    return false;
  }
  
  // Remove the color roles
  await member.roles.remove(colorRolesToRemove);
  return true;
}

// Login to Discord with your app's token
client.login(TOKEN);
