FROM node:22-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  python3 python3-pip python3-venv make g++ curl jq bash \
  # Browser dependencies
  chromium \
  fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
  && rm -rf /var/lib/apt/lists/*

# Puppeteer settings for Docker
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install uv (Python package manager for MCP servers)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

# Install gemini-cli globally
RUN npm install -g @google/gemini-cli

# Install opencode CLI globally (for multi-provider support)
RUN npm install -g opencode-ai

COPY package.json package-lock.json ./
RUN npm install

# 複製 workspace 目錄結構（含 .gemini 配置與 hooks）
COPY workspace ./workspace
RUN chmod +x workspace/.gemini/hooks/*.sh 2>/dev/null || true

# 預先安裝 mcp-memory-libsql 以避免執行時下載問題
RUN npm install -g mcp-memory-libsql

COPY src ./src
COPY tsconfig.json ./

# 複製 debug 腳本
COPY debug-container.sh ./
RUN chmod +x debug-container.sh

RUN npm run build

ENV NODE_ENV=production
ENV GEMINI_PROJECT_DIR=/app

CMD ["node", "dist/main.js"]
