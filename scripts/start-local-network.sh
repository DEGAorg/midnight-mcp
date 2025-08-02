#!/bin/bash

# Script to start a local Midnight network for development and testing
# This script assumes you have Docker and Docker Compose installed

# Set script to exit on any error
set -e

echo "Starting local Midnight development network..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create a directory for local data if it doesn't exist
mkdir -p ./local-network-data

# Create a docker-compose file for the local network
cat > ./local-network-docker-compose.yml << EOF
version: '3.8'

services:
  # Local Midnight node
  midnight-node:
    image: midnight/node:latest
    ports:
      - "5001:5001"  # Network API port
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
      # Add any other environment variables your node needs
    volumes:
      - ./local-network-data/node:/data
    networks:
      - local-network

  # Local Proof server
  proof-server:
    image: midnight/proof-server:latest
    ports:
      - "5002:5002"  # Proof server port
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
      - API_KEY=development-key
      # Add any other environment variables your proof server needs
    depends_on:
      - midnight-node
    volumes:
      - ./local-network-data/proof-server:/data
    networks:
      - local-network

networks:
  local-network:
    driver: bridge
EOF

# Start the network with Docker Compose
echo "Starting containers..."
docker-compose -f ./local-network-docker-compose.yml up -d

# Wait for services to be ready
echo "Waiting for services to start..."
attempt=0
max_attempts=30

until curl -s http://localhost:5001/health > /dev/null; do
  attempt=$((attempt + 1))
  if [ $attempt -ge $max_attempts ]; then
    echo "Timed out waiting for Midnight node to start"
    exit 1
  fi
  echo "Waiting for Midnight node to start... ($attempt/$max_attempts)"
  sleep 2
done

until curl -s http://localhost:5002/health > /dev/null; do
  attempt=$((attempt + 1))
  if [ $attempt -ge $max_attempts ]; then
    echo "Timed out waiting for Proof server to start"
    exit 1
  fi
  echo "Waiting for Proof server to start... ($attempt/$max_attempts)"
  sleep 2
done

echo "Local Midnight network is running!"
echo "  - Node API: http://localhost:5001"
echo "  - Proof Server: http://localhost:5002"
echo
echo "To stop the network, run: docker-compose -f ./local-network-docker-compose.yml down"
echo
echo "To run integration tests against this network:"
echo "  yarn test:integration" 