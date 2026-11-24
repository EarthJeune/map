# iGUIDE — Production Docker Image (Node.js 20 LTS + Express + SQLite3 MBTiles)
FROM node:20-slim

WORKDIR /app

# Install native build tools only if sqlite3 needs fallback compilation, then clean apt cache
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install production dependencies first for fast Docker layer caching
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy application source (large .mbtiles, .env, and mutable images/JSONs are excluded via .dockerignore or bind-mounted)
COPY . .

ENV NODE_ENV=production
ENV PORT=4321
ENV NO_TUNNEL=1

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:4321/api/tunnel').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
