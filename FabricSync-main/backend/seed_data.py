"""Seed sample data for FabricSync - spinning mill operations"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, date, timedelta
import bcrypt
from pymongo import MongoClient

MONGODB_URI = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/')
DB_NAME = os.environ.get('DB_NAME', 'fabricsync')

WORK_TYPES = [
    {'work_name': 'Mixing', 'wage_per_day': 400, 'wage_type': 'per_day', 'wage_per_unit': 0},
    {'work_name': 'Blow Room', 'wage_per_day': 400, 'wage_type': 'per_day', 'wage_per_unit': 0},
    {'work_name': 'Carding', 'wage_per_day': 400, 'wage_type': 'per_day', 'wage_per_unit': 0},
    {'work_name': 'Drawing', 'wage_per_day': 400, 'wage_type': 'per_day', 'wage_per_unit': 0},
    {'work_name': 'Simplex', 'wage_per_day': 400, 'wage_type': 'per_day', 'wage_per_unit': 0},
    {'work_name': 'Spinning', 'wage_per_day': 390, 'wage_type': 'per_day', 'wage_per_unit': 0},
    {'work_name': 'Winding / Autoconer', 'wage_per_day': 340, 'wage_type': 'per_day', 'wage_per_unit': 0},
    {'work_name': 'Packing', 'wage_per_day': 300, 'wage_type': 'per_day', 'wage_per_unit': 0},
]

WORKER_NAMES = [
    'Valli', 'Kumudha', 'Murugan', 'Ram', 'Rakesh', 'Milan',
    'Suresh', 'Babloo', 'Myna', 'Anil', 'Roja', 'Meenandhi',
    'Rinna', 'Sabitha', 'Saharika', 'Extra'
]

def seed(reset_work_data=False):
    """
    Seed FabricSync. Set reset_work_data=True to replace work types and workers
    with spinning mill defaults (use: python seed_data.py --reset)
    """
    client = MongoClient(MONGODB_URI)
    db = client[DB_NAME]

    if reset_work_data:
        db.work_types.delete_many({})
        db.workers.delete_many({})
        print('Cleared work_types and workers for fresh seed.')

    if db.users.count_documents({}) == 0:
        hashed = bcrypt.hashpw(b'admin123', bcrypt.gensalt(rounds=12))
        db.users.insert_one({
            'name': 'Admin User',
            'email': 'admin@fabricsync.com',
            'password': hashed.decode('utf-8'),
            'role': 'admin',
            'created_at': datetime.utcnow()
        })
        print('Created admin user: admin@fabricsync.com / admin123')

    if db.work_types.count_documents({}) == 0:
        for wt in WORK_TYPES:
            wt['created_at'] = datetime.utcnow()
            wt['updated_at'] = datetime.utcnow()
        db.work_types.insert_many(WORK_TYPES)
        print(f'Created {len(WORK_TYPES)} work types')

    wt_ids = list(db.work_types.find({}).sort('work_name', 1))
    wt_by_name = {wt['work_name'].lower(): str(wt['_id']) for wt in wt_ids}
    wt_default = str(wt_ids[0]['_id']) if wt_ids else None

    work_cycle = ['Spinning', 'Packing', 'Winding / Autoconer', 'Carding', 'Mixing', 'Blowroom', 'Drawing', 'Simplex']
    shift_cycle = ['shift1', 'shift2', 'shift3']

    if db.workers.count_documents({}) == 0 and wt_ids:
        workers = []
        for i, name in enumerate(WORKER_NAMES):
            wt_name = work_cycle[i % len(work_cycle)]
            wt_id = wt_by_name.get(wt_name.lower(), wt_default)
            shift = shift_cycle[i % len(shift_cycle)]
            workers.append({
                'name': name,
                'phone': f'+91 9876543{i:03d}',
                'skill_type': wt_name,
                'preferred_work': wt_name,
                'assigned_work_type': wt_id,
                'shift_preference': shift,
                'role': 'worker',
                'joining_date': datetime.utcnow() - timedelta(days=90),
                'status': 'active',
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            })
        db.workers.insert_many(workers)
        print(f'Created {len(workers)} workers')

    if db.fabrics.count_documents({}) == 0:
        fabrics = [
            {'fabric_name': 'Cotton Yarn 40s', 'type': 'Cotton', 'quantity': 5000, 'threshold_limit': 500, 'last_updated': datetime.utcnow(), 'created_at': datetime.utcnow()},
            {'fabric_name': 'Polyester Blend', 'type': 'Blend', 'quantity': 120, 'threshold_limit': 200, 'last_updated': datetime.utcnow(), 'created_at': datetime.utcnow()},
            {'fabric_name': 'Viscose 30s', 'type': 'Viscose', 'quantity': 3200, 'threshold_limit': 300, 'last_updated': datetime.utcnow(), 'created_at': datetime.utcnow()},
        ]
        db.fabrics.insert_many(fabrics)
        print(f'Created {len(fabrics)} fabric stocks')

    print('Seed complete.')

if __name__ == '__main__':
    import sys
    reset = '--reset' in sys.argv
    seed(reset_work_data=reset)
