# The Roommates Helper Discord Bot

A Discord bot designed to help manage the Roommates Discord server with features including:

- Color role assignment system
- Age verification system for 18+ content
- Role management utilities

## Setup Instructions

### Option 1: Local Development

1. Make sure Node.js and npm are installed on your system
2. Clone this repository
3. Copy `.env.example` to `.env` and fill in your Discord token and other settings
4. Install dependencies:
   ```bash
   npm install
   ```
5. Run the bot in development mode:
   ```bash
   npm run dev
   ```

### Option 2: Docker Deployment

1. Make sure Docker and Docker Compose are installed on your system
2. Clone this repository
3. Copy `.env.example` to `.env` and fill in your Discord token and other settings
4. Build and start the bot:
   ```bash
   docker-compose up -d
   ```
5. View logs:
   ```bash
   docker-compose logs -f
   ```

## Server Configuration

### Fetching Server Roles

To fetch your server's roles for the color role system:

1. Add your `SERVER_ID` to the `.env` file
2. Run the fetch-server-roles script:
   ```bash
   # Local
   npx ts-node fetch-server-roles.ts
   
   # Docker
   docker-compose exec roommates-helper npx ts-node fetch-server-roles.ts
   ```

### Setting Up Verification

1. Invite the bot to your server with proper permissions
2. Configure the verification channel:
   ```
   /modverify setchannel #your-mod-channel
   ```
3. Add a verification prompt in any channel:
   ```
   /verify
   ```

## Features

### Color Roles
- `/color select` - Choose a color for your username
- `/color remove` - Remove your current color

### Verification System
- `/verify` - Create a verification button for age-restricted content
- `/modverify setchannel` - Set the channel for verification reviews
- `/modverify status` - Check verification system status

## License

This project is licensed under the MIT License - see the LICENSE file for details.
