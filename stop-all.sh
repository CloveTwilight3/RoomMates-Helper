#!/bin/bash

# stop-all.sh - Stop all bot services

echo "🛑 Stopping The Roommates Helper services..."

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

# Stop Docker containers
print_status "Stopping Docker containers..."

if command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    print_warning "Docker Compose not found, trying manual container stop..."
    docker stop roommates-helper 2>/dev/null || true
    docker stop roommates-log-forwarder 2>/dev/null || true
fi

if [ -n "$DOCKER_COMPOSE" ]; then
    $DOCKER_COMPOSE down
fi

# Stop log forwarder if running
if [ -f .log-forwarder.pid ]; then
    LOG_PID=$(cat .log-forwarder.pid)
    if ps -p $LOG_PID > /dev/null 2>&1; then
        print_status "Stopping log forwarder (PID: $LOG_PID)..."
        kill $LOG_PID
        print_success "Log forwarder stopped"
    else
        print_warning "Log forwarder was not running"
    fi
    rm -f .log-forwarder.pid
else
    print_warning "No log forwarder PID file found"
fi

# Kill any remaining log forwarder processes
LOG_PROCESSES=$(pgrep -f "docker-log-forwarder" || true)
if [ -n "$LOG_PROCESSES" ]; then
    print_status "Killing remaining log forwarder processes..."
    echo "$LOG_PROCESSES" | xargs kill 2>/dev/null || true
fi

# Clean up log files (optional)
echo ""
echo "Would you like to clean up log files? (y/n)"
read -r response

if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    print_status "Cleaning up log files..."
    rm -f log-forwarder.log
    rm -f nohup.out
    print_success "Log files cleaned up"
fi

echo ""
print_success "✨ All services stopped successfully!"
echo ""
print_status "To start again, run: ./start-with-logging.sh"