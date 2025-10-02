from fastapi import FastAPI, APIRouter, HTTPException, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Admin wallet address (lowercase for comparison)
ADMIN_WALLET = '0xd9C4b8436d2a235A1f7DB09E680b5928cFdA641a'.lower()

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


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

# Helper function to prepare data for MongoDB
def prepare_for_mongo(data):
    if isinstance(data, dict):
        result = {}
        for k, v in data.items():
            if isinstance(v, datetime):
                result[k] = v.isoformat()
            else:
                result[k] = v
        return result
    return data

def parse_from_mongo(item):
    if not item:
        return item
    
    # Remove MongoDB's _id field to avoid ObjectId serialization issues
    if '_id' in item:
        del item['_id']
    
    # Parse datetime strings back to datetime objects
    if isinstance(item.get('created_at'), str):
        item['created_at'] = datetime.fromisoformat(item['created_at'].replace('Z', '+00:00'))
    if isinstance(item.get('clicked_at'), str):
        item['clicked_at'] = datetime.fromisoformat(item['clicked_at'].replace('Z', '+00:00'))
    if isinstance(item.get('timestamp'), str):
        item['timestamp'] = datetime.fromisoformat(item['timestamp'].replace('Z', '+00:00'))
    
    return item

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "PAYU Draw API - Squid Game Edition"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    prepared_data = prepare_for_mongo(status_obj.dict())
    _ = await db.status_checks.insert_one(prepared_data)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**parse_from_mongo(status_check)) for status_check in status_checks]

# Registration endpoints
@api_router.post("/save-ticket")
async def save_ticket(registration: TicketRegistrationCreate):
    try:
        # Check if wallet already exists
        existing = await db.registrations.find_one({"wallet": registration.wallet})
        if existing:
            return {"success": True, "message": "Already registered", "data": parse_from_mongo(existing)}
        
        # Create new registration
        reg_obj = TicketRegistration(
            wallet=registration.wallet,
            tx_hash=registration.txHash,
            index=registration.index,
            seed=registration.seed,
            ticket=registration.ticket,
            reward=registration.reward,
            timestamp=registration.timestamp
        )
        
        prepared_data = prepare_for_mongo(reg_obj.dict())
        await db.registrations.insert_one(prepared_data)
        
        return {"success": True, "message": "Registration saved", "data": reg_obj.dict()}
    except Exception as e:
        logging.error(f"Failed to save ticket: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/registration/{wallet}")
async def get_registration(wallet: str):
    try:
        registration = await db.registrations.find_one({"wallet": wallet})
        if not registration:
            return {"success": False, "message": "No registration found"}
        
        parsed_registration = parse_from_mongo(registration)
        return {"success": True, "data": parsed_registration}
    except Exception as e:
        logging.error(f"Failed to get registration: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Task endpoints
@api_router.post("/task-click")
async def log_task_click(task: TaskClickCreate):
    try:
        task_obj = TaskClick(
            user_id=task.wallet,
            platform=task.platform,
            handle=task.handle
        )
        
        prepared_data = prepare_for_mongo(task_obj.dict())
        await db.task_clicks.insert_one(prepared_data)
        
        return {"success": True, "message": "Task click logged"}
    except Exception as e:
        logging.error(f"Failed to log task click: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/tasks/{wallet}")
async def get_task_history(wallet: str):
    try:
        tasks = await db.task_clicks.find({"user_id": wallet}).to_list(100)
        parsed_tasks = [parse_from_mongo(task) for task in tasks]
        return {"success": True, "data": parsed_tasks}
    except Exception as e:
        logging.error(f"Failed to get task history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Admin verification helper
def verify_admin(wallet_address: Optional[str]) -> bool:
    """Verify if the wallet address is admin"""
    if not wallet_address:
        return False
    return wallet_address.lower() == ADMIN_WALLET
    
# Admin endpoints
@api_router.get("/admin/registrations")
async def get_all_registrations(x_wallet_address: Optional[str] = Header(None)):
    """Get all registrations (Admin only)"""
    if not verify_admin(x_wallet_address):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        registrations = await db.registrations.find().to_list(10000)
        parsed_registrations = [parse_from_mongo(reg) for reg in registrations]
        return {"success": True, "data": parsed_registrations}
    except Exception as e:
        logging.error(f"Failed to get registrations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/tasks")
async def get_all_tasks(x_wallet_address: Optional[str] = Header(None)):
    """Get all task completions (Admin only)"""
    if not verify_admin(x_wallet_address):
        raise HTTPException(status_code=403, detail="Admin access required")
        
    try:
        tasks = await db.task_clicks.find().to_list(10000)
        parsed_tasks = [parse_from_mongo(task) for task in tasks]
        return {"success": True, "data": parsed_tasks}
    except Exception as e:
        logging.error(f"Failed to get tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/start-giveaway")
async def start_giveaway(x_wallet_address: Optional[str] = Header(None)):
    """Start the giveaway countdown (Admin only)"""
    if not verify_admin(x_wallet_address):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Check if giveaway settings exist
        giveaway = await db.giveaway_settings.find_one({"_id": "main"})
        
        start_time = datetime.now(timezone.utc)
        
        if giveaway:
            # Update existing
            await db.giveaway_settings.update_one(
                {"_id": "main"},
                {"$set": {
                    "started": True,
                    "start_time": start_time.isoformat()
                }}
            )
        else:
            # Create new
            await db.giveaway_settings.insert_one({
                "_id": "main",
                "started": True,
                "start_time": start_time.isoformat()
            })
        
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
    try:
        giveaway = await db.giveaway_settings.find_one({"_id": "main"})
        
        if not giveaway:
            return {
                "success": True,
                "started": False,
                "start_time": None
            }
        
        return {
            "success": True,
            "started": giveaway.get("started", False),
            "start_time": giveaway.get("start_time")
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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
