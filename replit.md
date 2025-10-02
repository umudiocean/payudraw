# PAYU Giveaway - Squid Game Edition

## Overview
A Web3 blockchain-based giveaway platform with Squid Game theming. Users can connect their crypto wallet, participate in the giveaway, complete social media tasks, and track their entries.

## Tech Stack

### Frontend
- **Framework**: React 18 with Create React App
- **Styling**: Tailwind CSS with custom Squid Game theme
- **Web3**: RainbowKit v1.3.6 + Wagmi v1.4.13 for wallet connection
- **Blockchain**: Binance Smart Chain (BSC) Mainnet
- **Build Tool**: CRACO (Create React App Configuration Override)
- **Internationalization**: i18next (10 languages supported)
- **UI Components**: shadcn/ui with Radix UI primitives
- **Notifications**: Sonner (toast notifications)

### Backend
- **Framework**: FastAPI (Python)
- **Database**: MongoDB (requires external MongoDB instance)
- **Async Driver**: Motor for async MongoDB operations
- **Validation**: Pydantic v2
- **CORS**: Starlette middleware

### Blockchain
- **Network**: BSC Mainnet (Chain ID: 56)
- **Smart Contract**: 0x17A0D20Fc22c30a490FB6F186Cf2c31d738B5567
- **Registration Fee**: 0.00098 BNB

## Project Structure

```
.
├── backend/
│   ├── server.py          # FastAPI application
│   ├── requirements.txt   # Python dependencies
│   └── .env              # Backend environment variables
├── frontend/
│   ├── src/
│   │   ├── pages/        # Main pages (Home, Join, MyEntries, Admin)
│   │   ├── components/   # React components
│   │   ├── config/       # Web3 configuration (wagmi.js)
│   │   ├── i18n/         # Internationalization files
│   │   └── utils/        # Utility functions
│   ├── craco.config.js   # CRACO configuration
│   ├── package.json      # Frontend dependencies
│   └── .env             # Frontend environment variables
```

## Environment Setup

### Backend (.env)
The backend requires a MongoDB connection. You must provide a valid MongoDB URL:
```
MONGO_URL=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/
DB_NAME=payu_giveaway
CORS_ORIGINS=*
```

**⚠️ IMPORTANT**: The placeholder MongoDB URL in `backend/.env` will not work. You need to:
1. Create a free MongoDB Atlas account at https://www.mongodb.com/cloud/atlas
2. Create a cluster and database
3. Get your connection string
4. Update the `MONGO_URL` in `backend/.env`

### Frontend (.env)
```
REACT_APP_BACKEND_URL=https://workspace-umudiocean.replit.app
PORT=5000
```

## Current Configuration

### Backend Server
- **URL**: http://localhost:8001
- **Status**: Configured but requires valid MongoDB URL to run
- **API Prefix**: /api
- **Admin Wallet**: 0xd9C4b8436d2a235A1f7DB09E680b5928cFdA641a

### Frontend Server
- **URL**: https://workspace-umudiocean.replit.app (proxied on port 5000)
- **Status**: ✅ Running successfully
- **Host Configuration**: Allows all hosts (required for Replit iframe)

## Features

### User Features
1. **Multi-Wallet Support**
   - MetaMask
   - WalletConnect
   - Coinbase Wallet
   - Rainbow Wallet

2. **Automatic Registration**
   - Connect wallet
   - Automatic smart contract transaction
   - Backend registration tracking

3. **Social Media Tasks**
   - Telegram
   - Twitter (X)
   - Instagram Stories

4. **Ticket Management**
   - View registration details
   - Transaction hash tracking
   - Ticket number display

### Admin Features
- View all registrations
- Track task completions
- Start/manage giveaway countdown

### Internationalization
Supported languages:
- English, Turkish, French, German, Spanish
- Portuguese, Russian, Arabic, Chinese, Indonesian

## API Endpoints

### Public Endpoints
- `GET /api/` - API status
- `POST /api/save-ticket` - Save user registration
- `GET /api/registration/{wallet}` - Get user registration
- `POST /api/task-click` - Log task completion
- `GET /api/tasks/{wallet}` - Get user's task history
- `GET /api/giveaway-status` - Get giveaway status

### Admin Endpoints (require admin wallet)
- `GET /api/admin/registrations` - Get all registrations
- `GET /api/admin/tasks` - Get all task completions
- `POST /api/admin/start-giveaway` - Start giveaway countdown

## Smart Contract Configuration

Located in `frontend/src/config/wagmi.js`:
```javascript
CONTRACT_ADDRESS = '0x17A0D20Fc22c30a490FB6F186Cf2c31d738B5567'
REGISTRATION_FEE = '980000000000000' // 0.00098 BNB
```

## Known Issues & Setup Notes

### MongoDB Connection Required
The backend currently has a placeholder MongoDB URL. To make the backend functional:
1. Get a MongoDB connection string (Atlas recommended)
2. Update `backend/.env` with your MongoDB URL
3. Restart the Backend workflow

### Backend Current Status
- ❌ Not fully operational (MongoDB connection needed)
- Python dependencies: ✅ Installed
- Server configuration: ✅ Configured

### Frontend Status
- ✅ Fully operational
- All dependencies installed
- Properly configured for Replit environment
- Host settings allow iframe proxy

## Development Workflows

Two workflows are configured:

1. **Backend** (Console output)
   - Command: `cd backend && uvicorn server:app --host localhost --port 8001 --reload`
   - Port: 8001 (internal)
   - Requires: Valid MongoDB connection

2. **Frontend** (Webview output)
   - Command: `cd frontend && npm start`
   - Port: 5000 (exposed)
   - Status: ✅ Running

## Deployment Considerations

When deploying to production:
1. Use a production MongoDB instance
2. Update CORS settings to specific domain
3. Configure proper environment variables
4. Set up SSL/TLS for secure connections
5. Update smart contract settings if needed
6. Build frontend for production (`npm run build`)

## Recent Changes

- ✅ Installed Python 3.11 and Node.js 20
- ✅ Installed all Python backend dependencies
- ✅ Installed all Node.js frontend dependencies (with legacy peer deps)
- ✅ Fixed backend type issues (Optional[str] for admin verification)
- ✅ Configured CRACO to allow all hosts (required for Replit)
- ✅ Set up frontend on port 5000 with proper host binding (0.0.0.0)
- ✅ Created environment configuration files
- ✅ Fixed ajv dependency compatibility issue

## User Preferences

None specified yet.

## Next Steps

To make this application fully functional:
1. ✅ Provide a valid MongoDB connection URL
2. Update admin wallet address if needed
3. Test the full registration flow
4. Configure deployment settings for production
