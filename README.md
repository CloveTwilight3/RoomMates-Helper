# The Roommates Helper Discord Bot

A Discord bot designed to help manage the Roommates Discord server with features including:

- Color role assignment system
- Age verification system for 18+ content
- Auto-role assignment for new members
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
3. Configure the "Age Unverified" role for new members:
   ```
   /modverify setrole @Age-Unverified
   ```
4. Add a verification prompt in any channel:
   ```
   /verify
   ```
5. Check your verification configuration:
   ```
   /modverify status
   ```

## Features

### Color Roles
- `/color select` - Choose a color for your username
- `/color remove` - Remove your current color

### Verification System
- `/verify` - Create a verification button for age-restricted content
- `/modverify setchannel` - Set the channel for verification reviews
- `/modverify setrole` - Set the role for unverified members
- `/modverify status` - Check verification system status

### Auto-Role System
- The bot automatically assigns the "Age Unverified" role to new members when they join
- Upon successful verification, the "Age Unverified" role is removed and the "18+" role is added

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_application_client_id
GUILD_ID=your_server_id_for_development_testing

# Verification System
MOD_CHANNEL_ID=your_moderator_channel_id
AGE_UNVERIFIED_ROLE_ID=your_age_unverified_role_id
```

## Development

### Project Structure

- `bot.ts` - Main bot file with color role management and event handlers
- `verification.ts` - Age verification system
- `healthcheck.ts` - Bot health monitoring system
- `fetch-server-roles.ts` - Utility to fetch roles from the server

### Adding New Features

To add new features:

1. Add relevant command definitions in `registerCommands()`
2. Implement command handlers in `handleCommandInteraction()`
3. Add any needed event listeners

## Troubleshooting

### Bot Doesn't Respond to Commands

- Check if the bot is online with `docker-compose logs` or by checking its status in Discord
- Ensure the bot has the correct permissions in your server
- Make sure you've registered commands using the correct Guild ID

### Verification Issues

- Make sure you've set up a verification channel using `/modverify setchannel`
- Check if the bot has permissions to send messages in that channel
- Ensure the "Age Unverified" role exists and has been set with `/modverify setrole`

### Color Role Issues

- Make sure `roommates_roles.txt` exists and contains valid role data
- Run `npx ts-node fetch-server-roles.ts` to update the roles file

## License

This project is licensed under the MIT License - see the LICENSE file for details.
