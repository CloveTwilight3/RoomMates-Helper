// docker-log-forwarder.ts - Forwards Docker logs to Discord thread
import { Client, GatewayIntentBits } from 'discord.js';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import { DiscordLogger } from './discord-logger';

dotenv.config();

// Configuration
const TOKEN = process.env.DISCORD_TOKEN;
const THREAD_ID = '1376289945932660776';
const CONTAINER_NAME = 'roommates-helper'; // Your Docker container name

if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN not found in environment variables');
  process.exit(1);
}

// Create Discord client for log forwarding
const logClient = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Create Discord logger instance
const logger = new DiscordLogger(THREAD_ID);

/**
 * Start monitoring Docker logs
 */
function startDockerLogMonitoring() {
  console.log(`🐳 Starting Docker log monitoring for container: ${CONTAINER_NAME}`);
  
  // Start Docker logs command with follow flag
  const dockerLogs = spawn('docker', ['logs', '-f', '--tail', '100', CONTAINER_NAME], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Handle stdout (normal logs)
  dockerLogs.stdout.on('data', (data: Buffer) => {
    const logLines = data.toString().split('\n').filter(line => line.trim());
    
    for (const line of logLines) {
      if (line.trim()) {
        logger.dockerLog(line);
      }
    }
  });

  // Handle stderr (error logs)
  dockerLogs.stderr.on('data', (data: Buffer) => {
    const logLines = data.toString().split('\n').filter(line => line.trim());
    
    for (const line of logLines) {
      if (line.trim()) {
        logger.error(`[STDERR] ${line}`, 'Docker');
      }
    }
  });

  // Handle process errors
  dockerLogs.on('error', (error) => {
    console.error('❌ Docker logs process error:', error);
    logger.error(`Docker logs process error: ${error.message}`, 'Log Forwarder');
  });

  // Handle process exit
  dockerLogs.on('close', (code) => {
    console.log(`🐳 Docker logs process exited with code ${code}`);
    logger.warn(`Docker logs process exited with code ${code}`, 'Log Forwarder');
    
    // Restart monitoring after a delay if it wasn't intentional
    if (code !== 0) {
      setTimeout(() => {
        console.log('🔄 Restarting Docker log monitoring...');
        startDockerLogMonitoring();
      }, 5000);
    }
  });

  return dockerLogs;
}

/**
 * Check if Docker container is running
 */
async function checkContainerStatus(): Promise<boolean> {
  return new Promise((resolve) => {
    const dockerPS = spawn('docker', ['ps', '--filter', `name=${CONTAINER_NAME}`, '--format', '{{.Names}}']);
    
    let output = '';
    dockerPS.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });
    
    dockerPS.on('close', (code) => {
      const isRunning = output.trim().includes(CONTAINER_NAME);
      resolve(isRunning);
    });
    
    dockerPS.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Wait for container to be available
 */
async function waitForContainer(): Promise<void> {
  console.log(`⏳ Waiting for container ${CONTAINER_NAME} to be available...`);
  
  while (true) {
    const isRunning = await checkContainerStatus();
    
    if (isRunning) {
      console.log(`✅ Container ${CONTAINER_NAME} is running`);
      logger.success(`Container ${CONTAINER_NAME} detected and running`, 'Log Forwarder');
      break;
    }
    
    console.log(`⏳ Container ${CONTAINER_NAME} not found, waiting...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🚀 Starting Docker Log Forwarder...');
    
    // Login to Discord
    console.log('🔐 Connecting to Discord...');
    await logClient.login(TOKEN);
    console.log('✅ Connected to Discord');
    
    // Initialize logger
    logger.initialize(logClient);
    
    // Send startup message
    await logger.sendStartupMessage();
    logger.info('Docker Log Forwarder started successfully', 'Log Forwarder');
    
    // Wait for container to be available
    await waitForContainer();
    
    // Start monitoring Docker logs
    const dockerProcess = startDockerLogMonitoring();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      
      await logger.sendShutdownMessage();
      logger.info('Docker Log Forwarder shutting down', 'Log Forwarder');
      
      // Kill Docker logs process
      if (dockerProcess) {
        dockerProcess.kill();
      }
      
      // Disconnect from Discord
      logClient.destroy();
      
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      
      await logger.sendShutdownMessage();
      logger.info('Docker Log Forwarder shutting down', 'Log Forwarder');
      
      // Kill Docker logs process
      if (dockerProcess) {
        dockerProcess.kill();
      }
      
      // Disconnect from Discord
      logClient.destroy();
      
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Error starting Docker Log Forwarder:', error);
    logger.error(`Failed to start: ${error}`, 'Log Forwarder');
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  logger.error(`Uncaught Exception: ${error.message}`, 'Log Forwarder', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error(`Unhandled Rejection: ${reason}`, 'Log Forwarder');
});

// Start the forwarder
main();