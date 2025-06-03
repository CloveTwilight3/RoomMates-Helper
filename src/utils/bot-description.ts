/**
 * Bot Description Manager
 * ----------------------
 * Manages the bot's description changes for different states
 */

import { Client, REST, Routes } from 'discord.js';

// Description constants
const DESCRIPTIONS = {
  ONLINE: "But mom, we are just roommates",
  UPDATING: "Updating",
  STARTING: "Starting up...",
  ERROR: "Something went wrong"
};

/**
 * Update the bot's description
 */
async function updateBotDescription(client: Client, description: string) {
  if (!client.application) {
    console.error('❌ Client application not available for description update');
    return false;
  }

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
    
    // Update the application description
    await rest.patch(Routes.currentApplication(), {
      body: {
        description: description
      }
    });
    
    console.log(`✅ Bot description updated to: "${description}"`);
    return true;
    
  } catch (error) {
    console.error('❌ Error updating bot description:', error);
    return false;
  }
}

/**
 * Set bot description to online state
 */
async function setBotDescriptionOnline(client: Client) {
  return await updateBotDescription(client, DESCRIPTIONS.ONLINE);
}

/**
 * Set bot description to updating state
 */
async function setBotDescriptionUpdating(client: Client) {
  return await updateBotDescription(client, DESCRIPTIONS.UPDATING);
}

/**
 * Set bot description to starting state
 */
async function setBotDescriptionStarting(client: Client) {
  return await updateBotDescription(client, DESCRIPTIONS.STARTING);
}

/**
 * Set bot description to error state
 */
async function setBotDescriptionError(client: Client) {
  return await updateBotDescription(client, DESCRIPTIONS.ERROR);
}

/**
 * Setup description management with automatic online setting
 */
async function setupBotDescription(client: Client) {
  // Wait a bit for the client to be fully ready
  setTimeout(async () => {
    await setBotDescriptionOnline(client);
  }, 2000);
}

/**
 * Setup graceful shutdown description change
 */
function setupDescriptionShutdownHandlers(client: Client) {
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}, updating description and shutting down gracefully...`);
    
    try {
      // Set description to updating
      await setBotDescriptionUpdating(client);
      console.log('✅ Description updated to "Updating"');
      
      // Give it a moment to process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error('❌ Error updating description during shutdown:', error);
    }
  };

  // Handle graceful shutdown signals
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error('❌ Uncaught Exception:', error);
    try {
      await setBotDescriptionError(client);
    } catch (descError) {
      console.error('❌ Error setting error description:', descError);
    }
  });

  process.on('unhandledRejection', async (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    try {
      await setBotDescriptionError(client);
    } catch (descError) {
      console.error('❌ Error setting error description:', descError);
    }
  });

  console.log('✅ Description shutdown handlers registered');
}

// Export functions
export { 
  updateBotDescription,
  setBotDescriptionOnline,
  setBotDescriptionUpdating,
  setBotDescriptionStarting,
  setBotDescriptionError,
  setupBotDescription,
  setupDescriptionShutdownHandlers,
  DESCRIPTIONS
};