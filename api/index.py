import sys
from pathlib import Path

# Add backend directory to Python path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

# Import the FastAPI app
from server import app

# This is required for Vercel to recognize the ASGI app
# Vercel automatically handles ASGI apps when they're named 'app'
