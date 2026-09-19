#!/bin/bash

# ============================================================
# ATOM QMS - MySQL Database Setup Script
# ============================================================
# This script automates the database setup for Linux/Mac
# Prerequisites: MySQL server installed and running

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DB_USER="root"
DB_PASSWORD="12345"
DB_NAME="atom_qms"
DB_HOST="localhost"

echo ""
echo "============================================================"
echo "ATOM QMS - MySQL Database Setup"
echo "============================================================"
echo ""

echo "Configuring with:"
echo "- Username: $DB_USER"
echo "- Password: $DB_PASSWORD"
echo "- Database: $DB_NAME"
echo "- Host: $DB_HOST"
echo ""

# Step 1: Check if MySQL is installed
echo "[Step 1] Checking MySQL installation..."
if ! command -v mysql &> /dev/null; then
    echo -e "${RED}ERROR: MySQL command not found${NC}"
    echo "Please make sure MySQL is installed"
    echo ""
    echo "Installation help:"
    echo "macOS: brew install mysql"
    echo "Linux: sudo apt-get install mysql-client"
    exit 1
fi
echo -e "${GREEN}✓ MySQL found${NC}"
echo ""

# Step 2: Try to connect to MySQL
echo "[Step 2] Testing MySQL connection..."
if ! mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" &> /dev/null; then
    echo -e "${RED}ERROR: Cannot connect to MySQL${NC}"
    echo ""
    echo "Possible causes:"
    echo "- MySQL server is not running"
    echo "- Incorrect username or password"
    echo "- MySQL is not listening on localhost:3306"
    echo ""
    echo "Try:"
    echo "1. Start MySQL:"
    echo "   macOS: brew services start mysql"
    echo "   Linux: sudo systemctl start mysql"
    echo "2. Verify credentials are correct"
    echo ""
    exit 1
fi
echo -e "${GREEN}✓ MySQL connection successful${NC}"
echo ""

# Step 3: Create database
echo "[Step 3] Creating database '$DB_NAME'..."
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;"
if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Failed to create database${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Database created${NC}"
echo ""

# Step 4: Load schema
echo "[Step 4] Loading schema..."
if [ ! -f "database/schema.sql" ]; then
    echo -e "${RED}ERROR: schema.sql not found in database/ directory${NC}"
    echo "Make sure you're running this script from the project root directory"
    exit 1
fi

mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < database/schema.sql
if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Failed to load schema${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Schema loaded successfully${NC}"
echo ""

# Step 5: Load sample data (optional)
echo "[Step 5] Loading sample data (optional)"
if [ -f "database/seed-data.sql" ]; then
    read -p "Load sample data? (y/n): " LOAD_SAMPLE
    if [[ "$LOAD_SAMPLE" == "y" || "$LOAD_SAMPLE" == "Y" ]]; then
        mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < database/seed-data.sql
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Sample data loaded${NC}"
        else
            echo -e "${YELLOW}WARNING: Failed to load sample data${NC}"
        fi
    else
        echo "- Skipped sample data"
    fi
else
    echo -e "${YELLOW}WARNING: seed-data.sql not found${NC}"
fi
echo ""

# Step 6: Verify installation
echo "[Step 6] Verifying installation..."
TABLES=$(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW TABLES;" 2>&1 | wc -l)
TABLES=$((TABLES - 1))  # Subtract header row

if [ "$TABLES" -ge 6 ]; then
    echo -e "${GREEN}✓ All tables created successfully ($TABLES tables found)${NC}"
else
    echo -e "${YELLOW}WARNING: Expected 6+ tables but found $TABLES${NC}"
fi
echo ""

# Step 7: Show connection details
echo "============================================================"
echo "Setup Complete!"
echo "============================================================"
echo ""
echo "Connection Details:"
echo "- Host: $DB_HOST"
echo "- Port: 3306"
echo "- User: $DB_USER"
echo "- Password: $DB_PASSWORD"
echo "- Database: $DB_NAME"
echo ""
echo "Default Admin User:"
echo "- Username: admin"
echo "- Password: admin123"
echo ""
echo "Next Steps:"
echo "1. Test connection with:"
echo "   mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME -e \"SHOW TABLES;\""
echo ""
echo "2. Create your .env file with:"
echo "   DB_HOST=localhost"
echo "   DB_PORT=3306"
echo "   DB_USER=$DB_USER"
echo "   DB_PASSWORD=$DB_PASSWORD"
echo "   DB_NAME=$DB_NAME"
echo ""
echo "3. Set up Node.js backend:"
echo "   npm install mysql2 express dotenv"
echo "   Copy database-api.js to your backend"
echo ""
echo "============================================================"
echo ""
