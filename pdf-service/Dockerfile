# PDF rendering service — Puppeteer + Express + Handlebars.
# Uses node:slim with the Chromium dependencies Puppeteer needs.
# Railway picks this up automatically when deploying from this directory.

FROM node:20-slim AS base

# Chromium runtime libs that Puppeteer's bundled Chrome needs.
# Without these, Puppeteer launches but the browser process exits immediately.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc-s1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first for caching
COPY package*.json ./
RUN npm install --omit=dev=false

# Build TypeScript
COPY . .
RUN npm run build

# Strip dev dependencies to slim final image
RUN npm prune --omit=dev

ENV NODE_ENV=production
# Railway passes PORT; default to 3000 for local
ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/server.js"]
