"""MongoDB connection utility"""
from pymongo import MongoClient
from config import Config

client = None
db = None

def init_db():
    print("Skipping DB connection for now")

def get_db():
    """Get database instance"""
    global db
    if db is None:
        init_db()
    return db
