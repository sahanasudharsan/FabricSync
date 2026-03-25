"""Seed work types and wages as per requirements"""
import os
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/fabricsync')

def seed_work_types():
    client = MongoClient(MONGO_URI)
    db = client.get_database()
    
    work_types_data = [
        {"work_name": "Mixing", "wage_per_day": 400},
        {"work_name": "Blow Room", "wage_per_day": 400},
        {"work_name": "Carding", "wage_per_day": 400},
        {"work_name": "Drawing", "wage_per_day": 400},
        {"work_name": "Simplex", "wage_per_day": 400},
        {"work_name": "Spinning", "wage_per_day": 390},
        {"work_name": "Winding / Autoconer", "wage_per_day": 340},
        {"work_name": "Packing", "wage_per_day": 300}
    ]
    
    for wt in work_types_data:
        wt['wage_type'] = 'per_day'
        wt['created_at'] = datetime.utcnow()
        wt['updated_at'] = datetime.utcnow()
        
        # Update if exists, else insert
        db.work_types.update_one(
            {"work_name": wt['work_name']},
            {"$set": wt},
            upsert=True
        )
    
    print(f"Successfully seeded {len(work_types_data)} work types.")
    client.close()

if __name__ == "__main__":
    seed_work_types()
