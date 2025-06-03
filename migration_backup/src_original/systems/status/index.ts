/**
 * Status System for The Roommates Helper
 * -------------------------------------
 * Manages bot status rotation and dynamic status updates
 */

import { Client, ActivityType } from 'discord.js';
import { BotSystem } from '../../types';
import { logWithEmoji } from '../../utils';

//=============================================================================
// STATUS SYSTEM IMPLEMENTATION
//=============================================================================

export const statusSystem: BotSystem = {
  name: 'Status',
  enabled: true,
  
  setup: async (client: Client) => {
    logWithEmoji('info', 'Setting up status rotation system...', 'Status');
    setupRotatingStatus(client);
    logWithEmoji('success', 'Status system initialized', 'Status');
  },
  
  cleanup: async () => {
    logWithEmoji('info', 'Cleaning up status system...', 'Status');
    stopRotatingStatus();
  }
};

//=============================================================================
// STATUS CONFIGURATIONS
//=============================================================================

// Define your status rotations
const statusRotations = [
  { name: `Helping roommates`, type: ActivityType.Playing },
  { name: `with roommate drama`, type: ActivityType.Playing },
  { name: `confessions 👀`, type: ActivityType.Watching },
  { name: `for new roommates`, type: ActivityType.Watching },
  { name: `roommate gossip`, type: ActivityType.Listening },
  { name: `to your secrets`, type: ActivityType.Listening },
  { name: `age verification`, type: ActivityType.Custom, state: '🔞 Checking IDs' },
  { name: `the roommate chaos`, type: ActivityType.Custom, state: '🏠 Managing the chaos' },
  { name: `anonymous confessions`, type: ActivityType.Custom, state: '📝 Reading confessions' },
  { name: `NSFW access requests`, type: ActivityType.Custom, state: '🔒 Processing requests' },
  { name: `color role requests`, type: ActivityType.Custom, state: '🎨 Painting roles' },
  { name: `warning appeals`, type: ActivityType.Custom, state: '⚖️ Judging appeals' },
  { name: `"just roommates" energy`, type: ActivityType.Custom, state: '😏 Sure, "just roommates"' },
  { name: `the group chat`, type: ActivityType.Custom, state: '💬 Moderating chaos' }
];

//=============================================================================
// STATUS MANAGEMENT
//=============================================================================

let currentStatusIndex = 0;
let statusInterval: NodeJS.Timeout | null = null;

/**
 * Set up the rotating status system
 */
function setupRotatingStatus(client: Client): void {
  // Set initial status
  updateBotStatus(client);
  
  // Clear any existing interval
  if (statusInterval) {
    clearInterval(statusInterval);
  }
  
  // Rotate status every 30 seconds
  statusInterval = setInterval(() => {
    updateBotStatus(client);
  }, 30000);
  
  logWithEmoji('success', 'Status rotation started (30s intervals)', 'Status');
}

/**
 * Stop the rotating status system
 */
function stopRotatingStatus(): void {
  if (statusInterval) {
    clearInterval(statusInterval);
    statusInterval = null;
    logWithEmoji('info', 'Status rotation stopped', 'Status');
  }
}

/**
 * Update the bot's status to the next one in rotation
 */
function updateBotStatus(client: Client): void {
  if (!client.user) return;
  
  const status = statusRotations[currentStatusIndex];
  
  try {
    // Handle custom activities differently (they need a state)
    if (status.type === ActivityType.Custom) {
      client.user.setPresence({
        activities: [{ 
          name: status.name,
          type: status.type,
          state: (status as any).state || status.name
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
    
    // Log status change in development
    if (process.env.NODE_ENV === 'development') {
      logWithEmoji('info', `Status updated: ${status.name}`, 'Status');
    }
    
  } catch (error) {
    logWithEmoji('error', `Error updating bot status: ${error}`, 'Status');
  }
  
  // Move to next status
  currentStatusIndex = (currentStatusIndex + 1) % statusRotations.length;
}

/**
 * Add a new status to the rotation (for dynamic additions)
 */
export function addStatusToRotation(name: string, type: ActivityType, state?: string): void {
  statusRotations.push({ name, type, state } as any);
  logWithEmoji('success', `Added new status to rotation: ${name}`, 'Status');
}

/**
 * Set a temporary status (will return to rotation after specified time)
 */
export function setTemporaryStatus(
  client: Client, 
  name: string, 
  type: ActivityType, 
  durationMs: number, 
  state?: string
): void {
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
    
    logWithEmoji('info', `Temporary status set: ${name} (${durationMs/1000}s)`, 'Status');
    
    // Return to rotation after specified time
    setTimeout(() => {
      updateBotStatus(client);
      logWithEmoji('info', 'Returned to status rotation', 'Status');
    }, durationMs);
    
  } catch (error) {
    logWithEmoji('error', `Error setting temporary status: ${error}`, 'Status');
  }
}

/**
 * Set a specific status without affecting rotation
 */
export function setStaticStatus(client: Client, name: string, type: ActivityType, state?: string): void {
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
    
    logWithEmoji('info', `Static status set: ${name}`, 'Status');
    
  } catch (error) {
    logWithEmoji('error', `Error setting static status: ${error}`, 'Status');
  }
}

//=============================================================================
// EXPORTS
//=============================================================================

export {
  setupRotatingStatus,
  stopRotatingStatus,
  updateBotStatus
};
