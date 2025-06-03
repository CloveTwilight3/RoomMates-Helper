#!/bin/bash

# Migration script for The Roommates Helper
# Moves files to src/ directory structure

echo "🚀 Starting migration to src/ directory structure..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create src directory structure if it doesn't exist
print_status "Creating src directory structure..."

mkdir -p src/systems/{verification,moderation,logging,welcome,status}
mkdir -p src/database/{models,migrations}
mkdir -p src/utils
mkdir -p src/legacy

print_success "Directory structure created"

# Backup existing files
print_status "Creating backup of existing files..."
mkdir -p migration_backup
cp -r src migration_backup/src_original 2>/dev/null || true

# Move files to new locations
print_status "Moving files to new locations..."

# Move systems files
if [ -f "verification.ts" ]; then
    mv verification.ts src/legacy/verification.ts
    print_success "Moved verification.ts to src/legacy/"
fi

if [ -f "warning-system.ts" ]; then
    mv warning-system.ts src/legacy/warning-system.ts
    print_success "Moved warning-system.ts to src/legacy/"
fi

if [ -f "message-logger.ts" ]; then
    mv message-logger.ts src/systems/logging/message-logger.ts
    print_success "Moved message-logger.ts to src/systems/logging/"
fi

if [ -f "welcome-dm.ts" ]; then
    mv welcome-dm.ts src/systems/welcome/welcome-dm.ts
    print_success "Moved welcome-dm.ts to src/systems/welcome/"
fi

if [ -f "rotating-status.ts" ]; then
    mv rotating-status.ts src/systems/status/rotating-status.ts
    print_success "Moved rotating-status.ts to src/systems/status/"
fi

# Move utility files
if [ -f "bot-description.ts" ]; then
    mv bot-description.ts src/utils/bot-description.ts
    print_success "Moved bot-description.ts to src/utils/"
fi

if [ -f "healthcheck.ts" ]; then
    mv healthcheck.ts src/utils/healthcheck.ts
    print_success "Moved healthcheck.ts to src/utils/"
fi

if [ -f "discord-logger.ts" ]; then
    mv discord-logger.ts src/utils/discord-logger.ts
    print_success "Moved discord-logger.ts to src/utils/"
fi

if [ -f "docker-log-forwarder.ts" ]; then
    mv docker-log-forwarder.ts src/utils/docker-log-forwarder.ts
    print_success "Moved docker-log-forwarder.ts to src/utils/"
fi

if [ -f "fetch-server-roles.ts" ]; then
    mv fetch-server-roles.ts src/utils/fetch-server-roles.ts
    print_success "Moved fetch-server-roles.ts to src/utils/"
fi

# Move database files
if [ -f "database-setup.ts" ]; then
    mv database-setup.ts src/database/setup.ts
    print_success "Moved database-setup.ts to src/database/"
fi

if [ -d "migrations" ]; then
    if [ -f "migrations/json-to-db.ts" ]; then
        mv migrations/json-to-db.ts src/database/migrations/json-to-db.ts
        print_success "Moved migrations/json-to-db.ts to src/database/migrations/"
    fi
    rmdir migrations 2>/dev/null || print_warning "migrations directory not empty, left in place"
fi

if [ -d "models" ]; then
    if [ -f "models/index.ts" ]; then
        mv models/index.ts src/database/models/legacy-models.ts
        print_success "Moved models/index.ts to src/database/models/"
    fi
    rmdir models 2>/dev/null || print_warning "models directory not empty, left in place"
fi

# Delete backup files
print_status "Cleaning up backup files..."

backup_files=(
    "verification_config.json.backup"
    "message_logger_config.json.backup"
    "infractions.json.backup"
    "health.json.backup"
)

for file in "${backup_files[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        print_success "Deleted $file"
    fi
done

# Update import paths in key files
print_status "Updating import paths..."

# Update bot.ts to import from src
if [ -f "bot.ts" ]; then
    sed -i.bak "s|import './healthcheck'|import './src/utils/healthcheck'|g" bot.ts
    rm bot.ts.bak 2>/dev/null || true
    print_success "Updated import paths in bot.ts"
fi

# Update package.json scripts
if [ -f "package.json" ]; then
    print_status "Updating package.json scripts..."
    
    # Create a backup
    cp package.json package.json.migration.bak
    
    # Update scripts (this is a basic replacement - you may need to adjust manually)
    sed -i.tmp 's|ts-node database-setup.ts|ts-node src/database/setup.ts|g' package.json
    sed -i.tmp 's|ts-node fetch-server-roles.ts|ts-node src/utils/fetch-server-roles.ts|g' package.json
    sed -i.tmp 's|ts-node docker-log-forwarder.ts|ts-node src/utils/docker-log-forwarder.ts|g' package.json
    sed -i.tmp 's|ts-node migrations/json-to-db.ts|ts-node src/database/migrations/json-to-db.ts|g' package.json
    
    rm package.json.tmp 2>/dev/null || true
    print_success "Updated package.json scripts"
fi

# Update tsconfig.json
if [ -f "tsconfig.json" ]; then
    print_status "Updating tsconfig.json..."
    
    cp tsconfig.json tsconfig.json.migration.bak
    
    cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./",
    "baseUrl": "./",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": [
    "src/**/*",
    "bot.ts"
  ],
  "exclude": ["node_modules", "dist", "migration_backup"]
}
EOF
    
    print_success "Updated tsconfig.json"
fi

# Create updated system integrations
print_status "Creating integration files..."

# Create src/systems/welcome/index.ts
cat > src/systems/welcome/index.ts << 'EOF'
/**
 * Welcome System for The Roommates Helper
 * --------------------------------------
 * Manages welcome messages and new member processing
 */

import { Client, Events, GuildMember } from 'discord.js';
import { BotSystem } from '../../types';
import { logWithEmoji } from '../../utils';
import { sendWelcomeDM } from './welcome-dm';

export const welcomeSystem: BotSystem = {
  name: 'Welcome',
  enabled: true,
  
  setup: async (client: Client) => {
    logWithEmoji('info', 'Setting up welcome system...', 'Welcome');
    
    // Set up member join handler
    client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
      try {
        await sendWelcomeDM(member);
      } catch (error) {
        logWithEmoji('error', `Error sending welcome DM: ${error}`, 'Welcome');
      }
    });
    
    logWithEmoji('success', 'Welcome system initialized', 'Welcome');
  },
  
  cleanup: async () => {
    logWithEmoji('info', 'Cleaning up welcome system...', 'Welcome');
  }
};

export * from './welcome-dm';
EOF

# Create src/systems/logging/index.ts
cat > src/systems/logging/index.ts << 'EOF'
/**
 * Logging System for The Roommates Helper
 * --------------------------------------
 * Manages message logging and audit trails
 */

import { Client } from 'discord.js';
import { BotSystem } from '../../types';
import { logWithEmoji } from '../../utils';
import { setupMessageLogger, registerMessageLoggerCommands } from './message-logger';

export const loggingSystem: BotSystem = {
  name: 'Logging',
  enabled: true,
  
  setup: async (client: Client) => {
    logWithEmoji('info', 'Setting up logging system...', 'Logging');
    
    // Set up message logger
    setupMessageLogger(client);
    
    logWithEmoji('success', 'Logging system initialized', 'Logging');
  },
  
  cleanup: async () => {
    logWithEmoji('info', 'Cleaning up logging system...', 'Logging');
  }
};

export * from './message-logger';
EOF

print_success "Created integration files"

# Summary
echo ""
echo "========================================"
print_success "Migration completed successfully!"
echo "========================================"
echo ""
print_status "Summary of changes:"
echo "  ✅ Moved legacy files to src/legacy/"
echo "  ✅ Moved active files to appropriate src/ directories"
echo "  ✅ Updated import paths in bot.ts"
echo "  ✅ Updated package.json scripts"
echo "  ✅ Updated tsconfig.json"
echo "  ✅ Created system integration files"
echo "  ✅ Deleted backup files"
echo ""
print_warning "Manual steps still needed:"
echo "  1. Update src/commands/ files to use new import paths"
echo "  2. Test all systems after migration"
echo "  3. Update src/systems/index.ts with new system imports"
echo "  4. Verify database connections work with new paths"
echo ""
print_status "Backup files are available in migration_backup/ if needed"
print_status "Original package.json and tsconfig.json backups have .migration.bak extension"
echo ""
print_success "Migration script completed! 🎉"
