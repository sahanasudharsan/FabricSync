# FabricSync Backend for Vercel Serverless Functions

This directory contains the Flask backend configured for Vercel serverless deployment.

## Vercel Serverless Function Handler
"""
import sys
import os

# Add the backend directory to Python path
sys.path.append(os.path.dirname(__file__))

# Import the Flask app
from app import app

# Vercel serverless function handler
def handler(request):
    return app(request.environ, lambda status, headers: None)

# Export for Vercel
app.handler = handler
