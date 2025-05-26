#!/bin/bash

# start-with-logging.sh - Start the bot with Discord log forwarding

echo "🚀 Starting The Roommates Helper with Discord Logging..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    print_error ".env file not found. Please create it from .env.example"
    exit 1
fi

# Check if Docker Compose is available
if command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    print_error "Docker Compose not found. Please install Docker Compose."
    exit 1
fi

print_status "Building Docker containers..."
$DOCKER_COMPOSE build

print_status "Starting the bot container..."
$DOCKER_COMPOSE up -d roommates-helper

# Wait for the bot to be ready
print_status "Waiting for bot to initialize..."
sleep 5

# Check if bot is running
if docker ps | grep -q "roommates-helper"; then
    print_success "Bot container is running!"
else
    print_error "Bot container failed to start. Check logs with: docker logs roommates-helper"
    exit 1
fi

# Ask user if they want to start log forwarding
echo ""
echo "Would you like to start Discord log forwarding? (y/n)"
read -r response

if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    print_status "Starting Discord log forwarder..."
    
    # Build and run the log forwarder
    echo "Building log forwarder..."
    npm run build
    
    # Start log forwarder in background
    echo "Starting log forwarder (this will run in the background)..."
    nohup npm run log-forwarder > log-forwarder.log 2>&1 &
    LOG_FORWARDER_PID=$!
    
    print_success "Log forwarder started with PID: $LOG_FORWARDER_PID"
    print_status "Log forwarder output is being saved to: log-forwarder.log"
    
    # Save PID for later cleanup
    echo $LOG_FORWARDER_PID > .log-forwarder.pid
    
    echo ""
    print_success "✨ Bot and log forwarder are now running!"
    echo ""
    echo "📊 Useful commands:"
    echo "  View bot logs:           docker logs -f roommates-helper"
    echo "  View forwarder logs:     tail -f log-forwarder.log"
    echo "  Stop bot:               docker stop roommates-helper"
    echo "  Stop log forwarder:     kill \$(cat .log-forwarder.pid)"
    echo "  Stop everything:        ./stop-all.sh"
    echo ""
    echo "🔗 Discord logs will appear in thread: 1376289945932660776"
    
else
    print_success "✨ Bot is now running!"
    echo ""
    echo "📊 Useful commands:"
    echo "  View bot logs:     docker logs -f roommates-helper"
    echo "  Stop bot:         docker stop roommates-helper"
    echo ""
    print_warning "Discord log forwarding is disabled. Logs will only appear in Docker logs."
fi

echo ""
print_status "Setup complete! 🎉"