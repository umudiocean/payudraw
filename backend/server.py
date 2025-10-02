from fastapi import FastAPI, APIRouter, HTTPException, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import asyncpg


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Admin wallet address (lowercase for comparison)
ADMIN_WALLET = '0xd9C4b8436d2a235A1f7DB09E680b5928cFdA641a'.lower()

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Database connection pool
db_pool = None


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

class TicketRegistration(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    wallet: str
    tx_hash: str
    index: int
    seed: str
    ticket: str
    reward: str
    timestamp: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TicketRegistrationCreate(BaseModel):
    wallet: str
    txHash: str
    index: int
    seed: str
    ticket: str
    reward: str
    timestamp: int

class TaskClick(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # wallet address
    platform: str  # telegram, x, instagram_story
    handle: Optional[str] = None
    clicked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TaskClickCreate(BaseModel):
    wallet: str
    platform: str
    handle: Optional[str] = None


# Database initialization
async def init_db():
    global db_pool
    database_url = os.environ.get('POSTGRES_URL', os.environ.get('DATABASE_URL'))
    
    if not database_url:
        logging.warning("No database URL found, using in-memory storage")
        return
    
    try:
        db_pool = await asyncpg.create_pool(database_url, min_size=1, max_size=10)
        
        # Create tables
        async with db_pool.acquire() as conn:
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS registrations (
                    id TEXT PRIMARY KEY,
                    wallet TEXT UNIQUE NOT NULL,
                    tx_hash TEXT NOT NULL,
                    index INTEGER NOT NULL,
                    seed TEXT NOT NULL,
                    ticket TEXT NOT NULL,
                    reward TEXT NOT NULL,
                    timestamp BIGINT NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            ''')
            
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS task_clicks (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    platform TEXT NOT NULL,
                    handle TEXT,
                    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            ''')
            
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS giveaway_settings (
                    id TEXT PRIMARY KEY,
                    started BOOLEAN DEFAULT FALSE,
                    start_time TIMESTAMP WITH TIME ZONE
                )
            ''')
            
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS status_checks (
                    id TEXT PRIMARY KEY,
                    client_name TEXT NOT NULL,
                    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            ''')
        
        logging.info("Database initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize database: {e}")
        db_pool = None


@app.on_event("startup")
async def startup():
    await init_db()


@app.on_event("shutdown")
async def shutdown():
    if db_pool:
        await db_pool.close()


# Admin verification helper
def verify_admin(wallet_address: Optional[str]) -> bool:
    """Verify if the wallet address is admin"""
    if not wallet_address:
        return False
    return wallet_address.lower() == ADMIN_WALLET


# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "PAYU Draw API - Squid Game Edition"}


@api_router.post("/status")
async def create_status_check(input: StatusCheckCreate):
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    status_id = str(uuid.uuid4())
    async with db_pool.acquire() as conn:
        await conn.execute(
            'INSERT INTO status_checks (id, client_name) VALUES ($1, $2)',
            status_id, input.client_name
        )
    
    return {"id": status_id, "client_name": input.client_name}


@api_router.get("/status")
async def get_status_checks():
    if not db_pool:
        return []
    
    async with db_pool.acquire() as conn:
        rows = await conn.fetch('SELECT * FROM status_checks ORDER BY timestamp DESC LIMIT 1000')
        return [dict(row) for row in rows]


# Registration endpoints
@api_router.post("/save-ticket")
async def save_ticket(registration: TicketRegistrationCreate):
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        async with db_pool.acquire() as conn:
            # Check if wallet already exists
            existing = await conn.fetchrow('SELECT * FROM registrations WHERE wallet = $1', registration.wallet)
            if existing:
                return {"success": True, "message": "Already registered", "data": dict(existing)}
            
            # Create new registration
            reg_id = str(uuid.uuid4())
            await conn.execute('''
                INSERT INTO registrations (id, wallet, tx_hash, index, seed, ticket, reward, timestamp)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ''', reg_id, registration.wallet, registration.txHash, registration.index, 
               registration.seed, registration.ticket, registration.reward, registration.timestamp)
            
            new_reg = await conn.fetchrow('SELECT * FROM registrations WHERE id = $1', reg_id)
            return {"success": True, "message": "Registration saved", "data": dict(new_reg)}
    except Exception as e:
        logging.error(f"Failed to save ticket: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/registration/{wallet}")
async def get_registration(wallet: str):
    if not db_pool:
        return {"success": False, "message": "Database not available"}
    
    try:
        async with db_pool.acquire() as conn:
            registration = await conn.fetchrow('SELECT * FROM registrations WHERE wallet = $1', wallet)
            if not registration:
                return {"success": False, "message": "No registration found"}
            
            return {"success": True, "data": dict(registration)}
    except Exception as e:
        logging.error(f"Failed to get registration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Task endpoints
@api_router.post("/task-click")
async def log_task_click(task: TaskClickCreate):
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        task_id = str(uuid.uuid4())
        async with db_pool.acquire() as conn:
            await conn.execute('''
                INSERT INTO task_clicks (id, user_id, platform, handle)
                VALUES ($1, $2, $3, $4)
            ''', task_id, task.wallet, task.platform, task.handle)
        
        return {"success": True, "message": "Task click logged"}
    except Exception as e:
        logging.error(f"Failed to log task click: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/tasks/{wallet}")
async def get_task_history(wallet: str):
    if not db_pool:
        return {"success": True, "data": []}
    
    try:
        async with db_pool.acquire() as conn:
            tasks = await conn.fetch('SELECT * FROM task_clicks WHERE user_id = $1', wallet)
            return {"success": True, "data": [dict(task) for task in tasks]}
    except Exception as e:
        logging.error(f"Failed to get task history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Admin endpoints
@api_router.get("/admin/registrations")
async def get_all_registrations(x_wallet_address: Optional[str] = Header(None)):
    """Get all registrations (Admin only)"""
    if not verify_admin(x_wallet_address):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not db_pool:
        return {"success": True, "data": []}
    
    try:
        async with db_pool.acquire() as conn:
            registrations = await conn.fetch('SELECT * FROM registrations ORDER BY created_at DESC')
            return {"success": True, "data": [dict(reg) for reg in registrations]}
    except Exception as e:
        logging.error(f"Failed to get registrations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/admin/tasks")
async def get_all_tasks(x_wallet_address: Optional[str] = Header(None)):
    """Get all task completions (Admin only)"""
    if not verify_admin(x_wallet_address):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not db_pool:
        return {"success": True, "data": []}
    
    try:
        async with db_pool.acquire() as conn:
            tasks = await conn.fetch('SELECT * FROM task_clicks ORDER BY clicked_at DESC')
            return {"success": True, "data": [dict(task) for task in tasks]}
    except Exception as e:
        logging.error(f"Failed to get tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/admin/start-giveaway")
async def start_giveaway(x_wallet_address: Optional[str] = Header(None)):
    """Start the giveaway countdown (Admin only)"""
    if not verify_admin(x_wallet_address):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        start_time = datetime.now(timezone.utc)
        
        async with db_pool.acquire() as conn:
            # Check if giveaway settings exist
            giveaway = await conn.fetchrow('SELECT * FROM giveaway_settings WHERE id = $1', 'main')
            
            if giveaway:
                await conn.execute('''
                    UPDATE giveaway_settings 
                    SET started = TRUE, start_time = $1 
                    WHERE id = $2
                ''', start_time, 'main')
            else:
                await conn.execute('''
                    INSERT INTO giveaway_settings (id, started, start_time)
                    VALUES ($1, TRUE, $2)
                ''', 'main', start_time)
        
        return {
            "success": True,
            "message": "Giveaway started successfully",
            "start_time": start_time.isoformat()
        }
    except Exception as e:
        logging.error(f"Failed to start giveaway: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/giveaway-status")
async def get_giveaway_status():
    """Get giveaway status (public endpoint)"""
    if not db_pool:
        return {"success": True, "started": False, "start_time": None}
    
    try:
        async with db_pool.acquire() as conn:
            giveaway = await conn.fetchrow('SELECT * FROM giveaway_settings WHERE id = $1', 'main')
            
            if not giveaway:
                return {"success": True, "started": False, "start_time": None}
            
            return {
                "success": True,
                "started": giveaway.get("started", False),
                "start_time": giveaway.get("start_time").isoformat() if giveaway.get("start_time") else None
            }
    except Exception as e:
        logging.error(f"Failed to get giveaway status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
