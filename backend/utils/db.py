"""MongoDB connection utility"""
from pymongo import MongoClient
from config import Config

client = None
db = None

def init_db():
    """Initialize MongoDB connection"""
    global client, db
    client = MongoClient(Config.MONGODB_URI)
    db = client[Config.DB_NAME]
    return db

def get_db():
    """Get database instance"""
    global db
    if db is None:
        init_db()
    return db
