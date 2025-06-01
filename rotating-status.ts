/**
 * Rotating Status System
 * ----------------------
 * Manages the bot's activity status rotations
 */

import { Client, ActivityType } from 'discord.js';

// Define your status rotations
const statusRotations = [
  { name: `Helping roommates`, type: ActivityType.Playing },
  { name: `with roommate drama`, type: ActivityType.Playing },
  { name: `confessions 👀`, type: ActivityType.Watching },
  { name: `for new roommates`, type: ActivityType.Watching },
  { name: `roommate gossip`, type: ActivityType.Listening },
  { name: `to your secrets`, type: ActivityType.Listening },
  { name: `age verification`, type: ActivityType.Custom, state: '🔞 Checking IDs' },
  { name: `the roommate chaos`, type: ActivityType.Custom, state: '🏠 Managing' },
  { name: `anonymous confessions`, type: ActivityType.Custom, state: '📝 Reading' },
  { name: `NSFW access requests`, type: ActivityType.Custom, state: '🔒 Processing' },
  { name: `color role requests`, type: ActivityType.Custom, state: '🎨 Painting' },
  { name: `warning appeals`, type: ActivityType.Custom, state: '⚖️ Judging' },
  { name: `"just roommates" energy`, type: ActivityType.Custom, state: '😏 Sure thing' },
  { name: `the group chat`, type: ActivityType.Custom, state: '💬 Moderating' }
];

let currentStatusIndex = 0;
let statusInterval: NodeJS.Timeout | null = null;

/**
 * Set up the rotating status system
 */
function setupRotatingStatus(client: Client) {
  // Set initial status
  updateBotStatus(client);
  
  // Clear any existing interval
  if (statusInterval) {
    clearInterval(statusInterval);
  }
  
  // Rotate status every 30 seconds (adjust as needed)
  statusInterval = setInterval(() => {
    updateBotStatus(client);
  }, 30000); // 30 seconds
  
  console.log('✅ Rotating status system started');
}

/**
 * Stop the rotating status system
 */
function stopRotatingStatus() {
  if (statusInterval) {
    clearInterval(statusInterval);
    statusInterval = null;
    console.log('🛑 Rotating status system stopped');
  }
}

/**
 * Update the bot's status to the next one in rotation
 */
function updateBotStatus(client: Client) {
  if (!client.user) return;
  
  const status = statusRotations[currentStatusIndex];
  
  try {
    // Handle custom activities differently (they need a state)
    if (status.type === ActivityType.Custom) {
      client.user.setPresence({
        activities: [{ 
          name: status.name,
          type: status.type,
          state: status.state || status.name
        }],
        status: 'online',
      });
    } else {
      client.user.setPresence({
        activities: [{ 
          name: status.name, 
          type: status.type 
        }],
        status: 'online',
      });
    }
    
    // Log status change (optional - remove if too spammy)
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 Status updated: ${status.name}`);
    }
    
  } catch (error) {
    console.error('❌ Error updating bot status:', error);
  }
  
  // Move to next status
  currentStatusIndex = (currentStatusIndex + 1) % statusRotations.length;
}

/**
 * Add a new status to the rotation (for dynamic additions)
 */
function addStatusToRotation(name: string, type: ActivityType, state?: string) {
  statusRotations.push({ name, type, state });
  console.log(`✅ Added new status to rotation: ${name}`);
}

/**
 * Set a temporary status (will return to rotation after specified time)
 */
function setTemporaryStatus(client: Client, name: string, type: ActivityType, durationMs: number, state?: string) {
  if (!client.user) return;
  
  try {
    if (type === ActivityType.Custom) {
      client.user.setPresence({
        activities: [{ 
          name,
          type,
          state: state || name
        }],
        status: 'online',
      });
    } else {
      client.user.setPresence({
        activities: [{ name, type }],
        status: 'online',
      });
    }
    
    console.log(`⏰ Temporary status set: ${name} (${durationMs/1000}s)`);
    
    // Return to rotation after specified time
    setTimeout(() => {
      updateBotStatus(client);
      console.log(`🔄 Returned to status rotation`);
    }, durationMs);
    
  } catch (error) {
    console.error('❌ Error setting temporary status:', error);
  }
}

/**
 * Set a specific status without affecting rotation
 */
function setStaticStatus(client: Client, name: string, type: ActivityType, state?: string) {
  if (!client.user) return;
  
  try {
    if (type === ActivityType.Custom) {
      client.user.setPresence({
        activities: [{ 
          name,
          type,
          state: state || name
        }],
        status: 'online',
      });
    } else {
      client.user.setPresence({
        activities: [{ name, type }],
        status: 'online',
      });
    }
    
    console.log(`📌 Static status set: ${name}`);
    
  } catch (error) {
    console.error('❌ Error setting static status:', error);
  }
}

// Export functions for use in bot.ts
export { 
  setupRotatingStatus,
  stopRotatingStatus,
  updateBotStatus, 
  addStatusToRotation, 
  setTemporaryStatus,
  setStaticStatus
};