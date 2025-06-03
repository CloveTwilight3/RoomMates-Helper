// fetch-server-roles.ts
// A script to fetch all roles from a Discord server and save them in [ROLE_NAME, ROLE_ID] format

import { Client, GatewayIntentBits } from 'discord.js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Get environment variables
const TOKEN = process.env.DISCORD_TOKEN;
const SERVER_ID = process.env.SERVER_ID; // Add this to your .env file

// Check if required environment variables are set
if (!TOKEN) {
  console.error('Missing DISCORD_TOKEN in .env file');
  process.exit(1);
}

if (!SERVER_ID) {
  console.error('Missing SERVER_ID in .env file');
  console.error('Please add SERVER_ID=your_server_id to your .env file');
  process.exit(1);
}

// Create a new client instance with minimal intents
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// When the client is ready, fetch roles and save to file
client.once('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}`);
  
  try {
    // Fetch the server (guild)
    const guild = await client.guilds.fetch(SERVER_ID);
    
    if (!guild) {
      console.error(`Could not find server with ID ${SERVER_ID}`);
      process.exit(1);
    }
    
    console.log(`Fetching roles for server: ${guild.name}`);
    
    // Fetch all roles
    const roles = await guild.roles.fetch();
    
    // Generate role information in the requested format
    const roleData: string[] = [];
    
    // Add each role's data
    roles.forEach(role => {
      // Skip @everyone role if desired (uncomment to skip)
      // if (role.name === '@everyone') return;
      
      roleData.push(`[${role.name}, ${role.id}]`);
    });
    
    // Sort alphabetically by role name
    roleData.sort();
    
    // Save to file
    const filename = `${guild.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_roles.txt`;
    fs.writeFileSync(filename, roleData.join('\n'));
    
    console.log(`Roles saved to ${filename}`);
    
  } catch (error) {
    console.error('Error fetching roles:', error);
  }
  
  // Exit the process
  process.exit(0);
});

// Handle errors
client.on('error', (error) => {
  console.error('Discord client error:', error);
  process.exit(1);
});

// Login to Discord
console.log('Connecting to Discord...');
client.login(TOKEN);
