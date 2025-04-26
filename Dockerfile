FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache python3 make g++ git

# Install yarn
RUN corepack enable && corepack prepare yarn@4.1.0 --activate

# Copy package files
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

# Install dependencies
RUN yarn install --immutable

# Copy source code
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY scripts ./scripts

# Build the application
RUN yarn build:mcp

# Production stage
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for production
RUN apk add --no-cache python3 make g++

# Install yarn
RUN corepack enable && corepack prepare yarn@4.1.0 --activate

# Create a non-root user
RUN addgroup -S appuser && adduser -S -G appuser appuser

# Create wallet backup directory and logs directory with proper permissions
RUN mkdir -p /app/wallet-backups /app/logs && \
    chown -R appuser:appuser /app

# Copy package files
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

# Install production dependencies only
RUN yarn workspaces focus --production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create a directory for the wallet configuration
RUN mkdir -p /app/src/wallet/config && chown -R appuser:appuser /app/src

# Switch to non-root user
USER appuser

# Expose default port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV USE_EXTERNAL_PROOF_SERVER=true

# Command to run the application
CMD ["node", "--experimental-specifier-resolution=node", "dist/server.js"] 