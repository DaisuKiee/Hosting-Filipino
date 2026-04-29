# Multi-stage build for production

# Backend
FROM node:21-alpine AS backend
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY server ./server

# Frontend build
FROM node:21-alpine AS frontend-build
WORKDIR /app
COPY client/package*.json ./
RUN npm ci
COPY client ./
RUN npm run build

# Final production image
FROM node:21-alpine
WORKDIR /app

# Install Docker CLI for managing bot containers
RUN apk add --no-cache docker-cli

# Copy backend
COPY --from=backend /app/node_modules ./node_modules
COPY --from=backend /app/server ./server
COPY --from=backend /app/package.json ./

# Copy frontend build
COPY --from=frontend-build /app/build ./client/build

# Create bot-data directory
RUN mkdir -p /app/bot-data

EXPOSE 5000

CMD ["node", "server/index.js"]
