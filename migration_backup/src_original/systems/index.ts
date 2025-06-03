/**
 * Bot Systems Coordinator
 * ----------------------
 * Manages initialization of all bot systems
 */

import { Client } from 'discord.js';
import { logWithEmoji } from '../utils';
import { BotSystem } from '../types';

// Import all system modules
// Note: We'll create placeholder imports for now and update as we create the actual systems
// import { verificationSystem } from './verification';
// import { moderationSystem } from './moderation';
// import { loggingSystem } from './logging';
// import { welcomeSystem } from './welcome';
// import { statusSystem } from './status';

//=============================================================================
// SYSTEM DEFINITIONS
//=============================================================================

// Placeholder system implementations
// These will be replaced as we create the actual system files

const verificationSystem: BotSystem = {
  name: 'Verification',
  enabled: true,
  setup: async (client: Client) => {
    logWithEmoji('info', 'Verification system setup (placeholder)', 'Verification');
    // TODO: Replace with actual verification system setup
  }
};

const moderationSystem: BotSystem = {
  name: 'Moderation',
  enabled: true,
  setup: async (client: Client) => {
    logWithEmoji('info', 'Moderation system setup (placeholder)', 'Moderation');
    // TODO: Replace with actual moderation system setup
  }
};

const loggingSystem: BotSystem = {
  name: 'Logging',
  enabled: true,
  setup: async (client: Client) => {
    logWithEmoji('info', 'Logging system setup (placeholder)', 'Logging');
    // TODO: Replace with actual logging system setup
  }
};

const welcomeSystem: BotSystem = {
  name: 'Welcome',
  enabled: true,
  setup: async (client: Client) => {
    logWithEmoji('info', 'Welcome system setup (placeholder)', 'Welcome');
    // TODO: Replace with actual welcome system setup
  }
};

const statusSystem: BotSystem = {
  name: 'Status',
  enabled: true,
  setup: async (client: Client) => {
    logWithEmoji('info', 'Status system setup (placeholder)', 'Status');
    // TODO: Replace with actual status system setup
  }
};

//=============================================================================
// SYSTEM REGISTRY
//=============================================================================

/**
 * All bot systems in initialization order
 * Order matters! Systems that depend on others should come later
 */
const botSystems: BotSystem[] = [
  loggingSystem,      // Set up logging first
  verificationSystem, // Age verification system
  moderationSystem,   // Warning and punishment system
  welcomeSystem,      // Welcome messages for new members
  statusSystem        // Bot status and presence management
];

//=============================================================================
// SYSTEM MANAGEMENT
//=============================================================================

/**
 * Setup all bot systems
 */
export async function setupSystems(client: Client): Promise<void> {
  try {
    logWithEmoji('info', 'Setting up bot systems...', 'Systems');
    
    let successCount = 0;
    let failureCount = 0;
    
    // Initialize each system
    for (const system of botSystems) {
      try {
        if (!system.enabled) {
          logWithEmoji('info', `Skipping disabled system: ${system.name}`, 'Systems');
          continue;
        }
        
        logWithEmoji('info', `Setting up ${system.name} system...`, 'Systems');
        await system.setup(client);
        logWithEmoji('success', `${system.name} system ready`, 'Systems');
        successCount++;
        
      } catch (error) {
        logWithEmoji('error', `Failed to setup ${system.name} system: ${error}`, 'Systems');
        failureCount++;
        
        // Decide whether to continue or fail completely
        if (isSystemCritical(system)) {
          throw new Error(`Critical system ${system.name} failed to initialize`);
        }
      }
    }
    
    // Report final status
    const totalSystems = botSystems.filter(s => s.enabled).length;
    logWithEmoji('success', 
      `Bot systems initialized: ${successCount}/${totalSystems} successful`, 
      'Systems'
    );
    
    if (failureCount > 0) {
      logWithEmoji('warn', 
        `${failureCount} non-critical systems failed to initialize`, 
        'Systems'
      );
    }
    
  } catch (error) {
    logWithEmoji('error', `System setup failed: ${error}`, 'Systems');
    throw error;
  }
}

/**
 * Cleanup all bot systems
 */
export async function cleanupSystems(): Promise<void> {
  try {
    logWithEmoji('info', 'Cleaning up bot systems...', 'Systems');
    
    // Cleanup in reverse order
    const reversedSystems = [...botSystems].reverse();
    
    for (const system of reversedSystems) {
      try {
        if (!system.enabled || !system.cleanup) continue;
        
        logWithEmoji('info', `Cleaning up ${system.name} system...`, 'Systems');
        await system.cleanup();
        logWithEmoji('success', `${system.name} system cleaned up`, 'Systems');
        
      } catch (error) {
        logWithEmoji('error', `Failed to cleanup ${system.name} system: ${error}`, 'Systems');
        // Continue cleanup even if one system fails
      }
    }
    
    logWithEmoji('success', 'All systems cleaned up', 'Systems');
    
  } catch (error) {
    logWithEmoji('error', `System cleanup failed: ${error}`, 'Systems');
  }
}

/**
 * Check if a system is critical for bot operation
 */
function isSystemCritical(system: BotSystem): boolean {
  // Define which systems are critical
  const criticalSystems = ['Logging', 'Database'];
  return criticalSystems.includes(system.name);
}

/**
 * Get system by name
 */
export function getSystem(name: string): BotSystem | undefined {
  return botSystems.find(system => system.name === name);
}

/**
 * Get all systems
 */
export function getAllSystems(): BotSystem[] {
  return [...botSystems];
}

/**
 * Get enabled systems
 */
export function getEnabledSystems(): BotSystem[] {
  return botSystems.filter(system => system.enabled);
}

/**
 * Enable a system
 */
export function enableSystem(name: string): boolean {
  const system = getSystem(name);
  if (system) {
    system.enabled = true;
    logWithEmoji('info', `System enabled: ${name}`, 'Systems');
    return true;
  }
  return false;
}

/**
 * Disable a system
 */
export function disableSystem(name: string): boolean {
  const system = getSystem(name);
  if (system && !isSystemCritical(system)) {
    system.enabled = false;
    logWithEmoji('info', `System disabled: ${name}`, 'Systems');
    return true;
  }
  return false;
}

/**
 * Get system status
 */
export function getSystemStatus(): { name: string; enabled: boolean; critical: boolean }[] {
  return botSystems.map(system => ({
    name: system.name,
    enabled: system.enabled,
    critical: isSystemCritical(system)
  }));
}

/**
 * Restart a specific system
 */
export async function restartSystem(client: Client, name: string): Promise<boolean> {
  try {
    const system = getSystem(name);
    if (!system) {
      logWithEmoji('error', `System not found: ${name}`, 'Systems');
      return false;
    }
    
    logWithEmoji('info', `Restarting system: ${name}`, 'Systems');
    
    // Cleanup if possible
    if (system.cleanup) {
      await system.cleanup();
    }
    
    // Setup again
    await system.setup(client);
    
    logWithEmoji('success', `System restarted: ${name}`, 'Systems');
    return true;
    
  } catch (error) {
    logWithEmoji('error', `Failed to restart system ${name}: ${error}`, 'Systems');
    return false;
  }
}

//=============================================================================
// SYSTEM HEALTH MONITORING
//=============================================================================

/**
 * Check health of all systems
 */
export async function checkSystemHealth(): Promise<{ 
  healthy: boolean; 
  systems: { name: string; status: 'healthy' | 'unhealthy' | 'unknown' }[] 
}> {
  const systemHealth = [];
  let overallHealthy = true;
  
  for (const system of botSystems) {
    if (!system.enabled) {
      systemHealth.push({ name: system.name, status: 'unknown' as const });
      continue;
    }
    
    try {
      // Basic health check - system is healthy if it's enabled and no recent errors
      // In the future, systems could implement their own health check methods
      systemHealth.push({ name: system.name, status: 'healthy' as const });
    } catch (error) {
      systemHealth.push({ name: system.name, status: 'unhealthy' as const });
      if (isSystemCritical(system)) {
        overallHealthy = false;
      }
    }
  }
  
  return {
    healthy: overallHealthy,
    systems: systemHealth
  };
}

//=============================================================================
// EXPORTS
//=============================================================================

export {
  botSystems,
  verificationSystem,
  moderationSystem,
  loggingSystem,
  welcomeSystem,
  statusSystem
};
