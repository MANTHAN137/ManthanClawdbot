FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build TypeScript
RUN npm install typescript --save-dev && npm run build && rm -rf node_modules/.cache

# Environment variables
ENV NODE_ENV=production

# Expose port for health checks
EXPOSE 3000

# Start command
CMD [ "node", "dist/index.js" ]
