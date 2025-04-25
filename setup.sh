#!/bin/bash

# Setup script for Roommates Helper bot

# Make the script exit on any error
set -e

echo "Setting up The Roommates Helper Discord Bot..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker before continuing."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose is not installed. Please install Docker Compose before continuing."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "Please edit the .env file with your Discord token and other settings."
    echo ""
    echo "You'll need to set:"
    echo "- DISCORD_TOKEN: Your Discord bot token"
    echo "- CLIENT_ID: Your bot's client ID"
    echo "- SERVER_ID: Your Discord server ID"
    echo ""
    read -p "Press Enter to continue after editing the .env file..."
else
    echo ".env file already exists, skipping creation."
fi

# Create verification_config.json if it doesn't exist
if [ ! -f verification_config.json ]; then
    echo "Creating empty verification_config.json..."
    echo "{}" > verification_config.json
fi

# Build and start the Docker containers
echo "Building and starting Docker containers..."
docker-compose up -d --build

echo ""
echo "Setup complete! The Roommates Helper bot should now be running."
echo ""
echo "To check logs: docker-compose logs -f"
echo "To stop the bot: docker-compose down"
echo ""
echo "Don't forget to set up the verification channel with: /modverify setchannel"
