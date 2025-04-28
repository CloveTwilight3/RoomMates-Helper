FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Ensure health.json and verification_config.json are files, not directories
RUN rm -rf health.json verification_config.json || true
RUN echo '{"lastHeartbeat": 0, "status": "starting"}' > health.json && \
    echo '{}' > verification_config.json

# Set environment variables
ENV NODE_ENV=production

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node dist/healthcheck.js || exit 1

# Run the bot using the compiled JavaScript
CMD ["node", "dist/bot.js"]
