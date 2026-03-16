"""Seed employees and textile production stages as per user requirements"""
import os
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/fabricsync')

def seed_allocation():
    client = MongoClient(MONGO_URI)
    db = client.get_database()
    
    # 1. Seed Work Stages (Departments)
    work_types_data = [
        {"work_name": "Mixing", "wage_per_day": 400},
        {"work_name": "Blow Room", "wage_per_day": 400},
        {"work_name": "Carding", "wage_per_day": 400},
        {"work_name": "Drawing", "wage_per_day": 400},
        {"work_name": "Simplex", "wage_per_day": 400},
        {"work_name": "Spinning", "wage_per_day": 390},
        {"work_name": "Winding", "wage_per_day": 340},
        {"work_name": "Packing", "wage_per_day": 300}
    ]
    
    work_type_map = {}
    for wt in work_types_data:
        wt['wage_type'] = 'per_day'
        wt['created_at'] = datetime.utcnow()
        wt['updated_at'] = datetime.utcnow()
        
        # Update if exists, else insert
        res = db.work_types.update_one(
            {"work_name": wt['work_name']},
            {"$set": wt},
            upsert=True
        )
        
        # Get the ID for assignment
        wt_doc = db.work_types.find_one({"work_name": wt['work_name']})
        work_type_map[wt['work_name']] = str(wt_doc['_id'])
    
    print(f"Successfully seeded {len(work_types_data)} work stages.")

    # 2. Seed Employees
    employees = [
        "Ram", "Babloo", "Saharika", "Sabitha", "Kumudha", "Murugan", "Samar", 
        "Pratheep", "Prathima", "Mama", "Madhesh", "Valli", "Sadagopal", 
        "Milan", "Myna", "Aniul", "Roja"
    ]
    
    # Simple strategy to assign employees to stages
    stages_list = list(work_type_map.keys())
    
    for i, name in enumerate(employees):
        # Cycle through stages for seeding
        assigned_stage_name = stages_list[i % len(stages_list)]
        assigned_work_id = work_type_map[assigned_stage_name]
        
        emp_doc = {
            "name": name,
            "phone": "",
            "skill_type": assigned_stage_name,
            "preferred_work": assigned_stage_name,
            "assigned_work_type": assigned_work_id,
            "shift_preference": "shift1",
            "role": "worker",
            "joining_date": datetime.utcnow(),
            "status": "active",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # Update if exists, else insert
        db.workers.update_one(
            {"name": name},
            {"$set": emp_doc},
            upsert=True
        )
    
    print(f"Successfully seeded {len(employees)} employees and assigned them to work stages.")
    client.close()

if __name__ == "__main__":
    seed_allocation()
