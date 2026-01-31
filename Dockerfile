FROM node:22-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python3-venv make g++ curl jq bash \
  && rm -rf /var/lib/apt/lists/*

# Install uv (Python package manager for MCP servers)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

# Install gemini-cli globally
RUN npm install -g @google/gemini-cli

COPY package.json package-lock.json ./
RUN npm install

# 複製 .gemini 配置與 hooks（需要在 build 之前）
COPY .gemini ./.gemini
RUN chmod +x .gemini/hooks/*.sh 2>/dev/null || true

COPY src ./src
COPY tsconfig.json ./

RUN npm run build

ENV NODE_ENV=production
ENV GEMINI_PROJECT_DIR=/app

CMD ["node", "dist/main.js"]
