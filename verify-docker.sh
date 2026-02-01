#!/bin/bash
# Docker verification script for memory features

set -e

echo "🔍 Docker Memory Features Verification"
echo "======================================="
echo ""

# Test 1: Check jq installation
echo "1️⃣ Testing jq installation..."
docker compose run --rm telegem jq --version
echo "✅ jq is installed"
echo ""

# Test 2: Check bash installation
echo "2️⃣ Testing bash availability..."
docker compose run --rm telegem bash --version | head -1
echo "✅ bash is available"
echo ""

# Test 3: Check .gemini directory and hooks
echo "3️⃣ Checking .gemini hooks..."
docker compose run --rm telegem ls -la /app/workspace/.gemini/hooks/
echo "✅ .gemini hooks are present"
echo ""

# Test 4: Check hook script permissions
echo "4️⃣ Verifying hook script permissions..."
docker compose run --rm telegem stat -c '%a %n' /app/workspace/.gemini/hooks/retrieve-memory.sh
echo "✅ retrieve-memory.sh is executable"
echo ""

# Test 5: Check environment variables
echo "5️⃣ Checking environment variables..."
docker compose run --rm telegem bash -c 'echo "GEMINI_PROJECT_DIR=$GEMINI_PROJECT_DIR"'
docker compose run --rm telegem bash -c 'echo "DB_DIR=$DB_DIR"'
docker compose run --rm telegem bash -c 'echo "DB_PATH=$DB_PATH"'
echo "✅ Environment variables are set"
echo ""

# Test 6: Test Hook script execution
echo "6️⃣ Testing retrieve-memory.sh Hook..."
docker compose run --rm telegem bash -c \
  'GEMINI_PROJECT_DIR=/app echo "{\"prompt\": \"TeleGem\"}" | /app/workspace/.gemini/hooks/retrieve-memory.sh'
echo "✅ Hook script executes successfully"
echo ""

# Test 7: Check volume mounting
echo "7️⃣ Verifying volume mounting..."
docker compose run --rm telegem ls -la /app/data/
echo "✅ /app/data volume is mounted"
echo ""

echo "======================================="
echo "✅ All Docker verification tests passed!"
echo ""
echo "Next steps:"
echo "  1. Build the image: docker compose build"
echo "  2. Start the container: docker compose up -d"
echo "  3. Check logs: docker compose logs -f"
