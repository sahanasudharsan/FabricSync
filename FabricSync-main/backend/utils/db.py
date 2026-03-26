from pymongo import MongoClient
import os

client = None
db = None

def init_db():
    global client, db

    try:
        mongo_uri = os.getenv("MONGODB_URI")
        db_name = os.getenv("DB_NAME", "fabricsync")

        client = MongoClient(mongo_uri)
        db = client[db_name]

        print("✅ MongoDB connected successfully")

    except Exception as e:
        print(f"❌ MongoDB connection error: {e}")


def get_db():
    return db