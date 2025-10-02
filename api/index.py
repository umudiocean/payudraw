import sys
import os
from pathlib import Path

# Add backend directory to path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

# Set environment for production
os.environ.setdefault('PYTHON_ENV', 'production')

from server import app

# Vercel serverless function handler
def handler(request, context):
    return app(request, context)

# Also export app directly for compatibility
__all__ = ['handler', 'app']
