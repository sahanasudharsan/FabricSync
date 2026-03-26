from pymongo import MongoClient
import os

client = None
db = None

def init_db():
    global client, db

    try:
        # Prefer explicit environment variable from .env or deploy config
        mongo_uri = os.getenv("MONGODB_URI")

        # Fallback to Config default (includes localhost default)
        if not mongo_uri:
            from config.settings import Config
            mongo_uri = Config.MONGODB_URI

        db_name = os.getenv('DB_NAME', "fabricsync")

        if not mongo_uri:
            raise ValueError("MONGODB_URI is not set. Please configure it in .env")

        client = MongoClient(mongo_uri)
        db = client[db_name]

        print("✅ MongoDB connected successfully")

    except Exception as e:
        print(f"❌ MongoDB connection error: {e}")


def get_db():
    return db