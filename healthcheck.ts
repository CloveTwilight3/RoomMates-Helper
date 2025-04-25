// healthcheck.ts - Simple script to check if the bot is healthy
import fs from 'fs';

// File to track bot status
const HEALTH_FILE = 'health.json';

// Interface for health data
interface HealthData {
  lastHeartbeat: number;
  status: 'online' | 'offline' | 'starting';
  uptime?: number;
  startTime?: number;
}

/**
 * Write the health status to a file
 */
export function writeHealthStatus(status: 'online' | 'offline' | 'starting', startTime?: number): void {
  try {
    const healthData: HealthData = {
      lastHeartbeat: Date.now(),
      status,
    };

    if (startTime) {
      healthData.startTime = startTime;
      healthData.uptime = Math.floor((Date.now() - startTime) / 1000); // Uptime in seconds
    }

    fs.writeFileSync(HEALTH_FILE, JSON.stringify(healthData, null, 2));
  } catch (error) {
    console.error('Error writing health status:', error);
  }
}

/**
 * Read the health status from the file
 */
export function readHealthStatus(): HealthData | null {
  try {
    if (fs.existsSync(HEALTH_FILE)) {
      const data = fs.readFileSync(HEALTH_FILE, 'utf8');
      return JSON.parse(data) as HealthData;
    }
  } catch (error) {
    console.error('Error reading health status:', error);
  }
  return null;
}

/**
 * Check if the bot is healthy
 * Returns true if healthy, false otherwise
 */
export function isHealthy(): boolean {
  const health = readHealthStatus();
  
  if (!health) {
    return false;
  }
  
  // Check if the last heartbeat was within the last 2 minutes
  const twoMinutes = 2 * 60 * 1000;
  const isRecent = Date.now() - health.lastHeartbeat < twoMinutes;
  
  return health.status === 'online' && isRecent;
}

// If this file is run directly, output health status
if (require.main === module) {
  const health = readHealthStatus();
  
  if (health) {
    console.log(`Status: ${health.status}`);
    console.log(`Last heartbeat: ${new Date(health.lastHeartbeat).toISOString()}`);
    
    if (health.startTime) {
      console.log(`Start time: ${new Date(health.startTime).toISOString()}`);
      const uptimeSeconds = Math.floor((Date.now() - health.startTime) / 1000);
      const days = Math.floor(uptimeSeconds / 86400);
      const hours = Math.floor((uptimeSeconds % 86400) / 3600);
      const minutes = Math.floor((uptimeSeconds % 3600) / 60);
      const seconds = uptimeSeconds % 60;
      
      console.log(`Uptime: ${days}d ${hours}h ${minutes}m ${seconds}s`);
    }
    
    if (isHealthy()) {
      console.log('Health check: PASSED');
      process.exit(0); // Exit with success code
    } else {
      console.log('Health check: FAILED');
      process.exit(1); // Exit with error code
    }
  } else {
    console.log('No health data available');
    process.exit(1); // Exit with error code
  }
}
