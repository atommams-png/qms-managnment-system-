# 🚀 Quick Reference - MySQL Setup Complete

## ✅ What Has Been Done

✓ **Removed all localStorage dependencies**
✓ **Created MySQL database schema**
✓ **Updated frontend to use API**
✓ **Added Vite proxy configuration**
✓ **Created database initialization script**

## 🎯 Quick Start (3 Steps)

### Option 1: Automatic Startup (Easiest)

**Windows:**
```bash
double-click start.bat
```

**Mac/Linux:**
```bash
bash start.sh
```

### Option 2: Manual Startup

**Terminal 1 - Initialize Database:**
```bash
cd backend
npm run init:db
```

**Terminal 2 - Start Backend:**
```bash
cd backend
npm run dev
```

**Terminal 3 - Start Frontend:**
```bash
npm run dev
```

## 📱 Access Points

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/api/health

## 👤 Login Credentials

- **Username**: admin
- **Password**: admin123

## 🗄️ Database Info

- **Type**: MySQL
- **Host**: localhost
- **Port**: 3306
- **Database**: code_exam_guard
- **User**: root
- **Password**: 12345

## 🔄 Data Flow

```
Frontend (React)
      ↓
   [API Call]
      ↓
Vite Proxy (port 5173)
      ↓
Backend Express (port 5000)
      ↓
MySQL Database
```

## 📊 Database Tables

1. `admins` - Admin users
2. `exams` - Exam configurations
3. `questions` - Exam questions
4. `candidates` - Student registrations
5. `exam_attempts` - Student responses
6. `exam_results` - Calculated scores

## ⚙️ Key Files

| File | Purpose |
|------|---------|
| `database/init.js` | Database initialization |
| `backend/server.js` | Express server |
| `backend/db.js` | MySQL connection |
| `src/lib/store.ts` | API wrapper (was localStorage) |
| `src/lib/api.ts` | HTTP API client |
| `vite.config.ts` | Frontend proxy config |
| `backend/.env` | Database credentials |

## 🆘 Troubleshooting

### "Cannot connect to MySQL"
- Ensure MySQL service is running
- Windows: Open Services and start MySQL80
- Check credentials in `backend/.env`

### "Port 5000 already in use"
- Kill existing process on port 5000
- Or change PORT in `backend/.env`

### "Database tables not created"
- Run `npm run init:db` again
- Check MySQL user permissions

### "Frontend can't reach backend"
- Verify backend is running on port 5000
- Check Vite proxy in `vite.config.ts`
- Ensure CORS is enabled in `backend/server.js`

## 📝 Important Notes

✅ All data is now persistent in MySQL
✅ No data loss when browser cache is cleared
✅ Data accessible across devices
✅ Ready for team collaboration
✅ No more localStorage errors
✅ Production-ready setup

## 🎓 Next Steps

1. ✅ Initialize database (`npm run init:db`)
2. ✅ Start backend (`npm run dev` in backend/)
3. ✅ Start frontend (`npm run dev`)
4. ✅ Login with admin/admin123
5. ✅ Create exams and manage candidates
6. 📚 Read MYSQL_SETUP.md for detailed docs

## 📚 Documentation

- **Setup Guide**: See `MYSQL_SETUP.md`
- **API Reference**: See routes in `backend/routes/`
- **Database Schema**: See `database/schema.sql`

---

**Version**: 1.0.0
**Status**: ✅ Ready to Use
**Last Updated**: 2026-03-30
