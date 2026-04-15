#!/bin/bash
# Code Exam Guard - Quick Start Script

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     🚀 Code Exam Guard - MySQL Edition                   ║"
echo "║     Quick Start Script                                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if MySQL is running
echo -e "${BLUE}📋 Checking MySQL server...${NC}"
if ! mysql -h localhost -u root -p12345 -e "SELECT 1" 2>/dev/null > /dev/null; then
    echo -e "${YELLOW}⚠️  MySQL server might not be running!${NC}"
    echo "   Please start MySQL service and try again."
    echo "   Windows: net start MySQL80 (or your MySQL service name)"
    echo "   Mac/Linux: mysql.server start"
    exit 1
fi
echo -e "${GREEN}✓ MySQL is running${NC}"
echo ""

# Initialize database if needed
echo -e "${BLUE}📌 Step 1: Initializing database...${NC}"
cd backend
npm run init:db
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Database initialization had an issue${NC}"
    echo "   Check MySQL credentials and try again"
    cd ..
    exit 1
fi
echo ""

# Start backend
echo -e "${BLUE}📌 Step 2: Starting backend server...${NC}"
npm run dev &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend starting on port 5000${NC}"
sleep 2
cd ..
echo ""

# Start frontend
echo -e "${BLUE}📌 Step 3: Starting frontend application...${NC}"
npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend starting on port 5173${NC}"
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║      ✅ Application Started Successfully!                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}📱 Frontend:${NC}  http://localhost:5173"
echo -e "${GREEN}🔌 Backend API:${NC}  http://localhost:5000/api"
echo -e "${GREEN}📊 Database:${NC}   localhost:3306/code_exam_guard"
echo ""
echo -e "${YELLOW}📝 Admin Login:${NC}"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"
echo ""

# Wait for both processes
wait
