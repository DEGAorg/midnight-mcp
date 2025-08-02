# ────────────────────────
# Builder stage
# ────────────────────────
FROM node:22.15.1-alpine AS builder

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache python3 make g++ git

# Set up Yarn 4
RUN corepack enable && corepack prepare yarn@4.1.0 --activate

# Copy required files
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

# Install full deps for build
RUN yarn install

# Copy sources and config
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY scripts ./scripts

# Build MCP server
RUN yarn build

# ────────────────────────
# Production stage
# ────────────────────────
FROM node:22.15.1-alpine

WORKDIR /app

# Minimal system dependencies
RUN apk add --no-cache wget

# Yarn 4 setup
RUN corepack enable && corepack prepare yarn@4.1.0 --activate

# Copy minimal package info and Yarn plugins
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

# Install production-only dependencies
RUN yarn workspaces focus --production --all

# Create required runtime directories
RUN mkdir -p /app/.storage /app/logs \
 && chown -R node:node /app/.storage /app/logs \
 && chmod -R 755 /app/.storage /app/logs

# Switch to non-root user
USER node

# Copy built server from builder stage
COPY --from=builder /app/dist ./dist

# Expose default port
EXPOSE 3000

# Runtime environment
ENV NODE_ENV=production \
    WALLET_SERVER_PORT=3000 \
    WALLET_SERVER_HOST=wallet-server

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget --spider --quiet http://localhost:3000/health || exit 1

# Launch the wallet server
CMD ["node", "--experimental-specifier-resolution=node", "dist/server.js"]
