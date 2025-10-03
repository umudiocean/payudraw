import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from server import app
from mangum import Mangum

# Wrap FastAPI with Mangum for serverless
handler = Mangum(app, lifespan="off")
