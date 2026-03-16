"""
Automatic salary calculation logic.

Workers: Salary = sum of daily_wages for the month (or Present Days × wage_per_day if no daily_wages)
Supervisor: Fixed 25000 Rs/month
Fitters: Fixed 16000 Rs/month each (3 fitters)

Includes: overtime, bonus, deductions
final_salary = calculated_salary + overtime + bonus - deductions
"""
from datetime import datetime, date
from calendar import monthrange
from bson import ObjectId

SUPERVISOR_SALARY = 25000
FITTER_SALARY = 16000

def calculate_salary_for_worker(db, worker_id, year, month):
    """
    Calculate salary for a worker for a given month.
    Returns dict with total_work_done, total_present_days, calculated_salary, role, etc.
    """
    wid = ObjectId(worker_id) if isinstance(worker_id, str) else worker_id
    worker = db.workers.find_one({'_id': wid})
    if not worker:
        return None

    role = (worker.get('role') or 'worker').lower()
    worker_id_str = str(worker['_id'])
    start = datetime(year, month, 1)
    _, last_day = monthrange(year, month)
    end = datetime(year, month, last_day, 23, 59, 59)

    if role == 'supervisor':
        return {
            'total_work_done': 0,
            'total_present_days': 0,
            'wage_type': 'fixed',
            'calculated_salary': SUPERVISOR_SALARY,
            'role': role
        }
    if role == 'fitter':
        return {
            'total_work_done': 0,
            'total_present_days': 0,
            'wage_type': 'fixed',
            'calculated_salary': FITTER_SALARY,
            'role': role
        }

    # Worker: prefer daily wage from work_type
    work_type_id = worker.get('assigned_work_type')
    work_type = None
    if work_type_id and ObjectId.is_valid(str(work_type_id)):
        work_type = db.work_types.find_one({'_id': ObjectId(work_type_id)})
    
    # Get attendance records for the month - use proper datetime comparison
    attendance_records = list(db.attendance.find({
        'worker_id': worker_id_str,
        'date': {
            '$gte': start,
            '$lte': end
        },
        'status': 'present'
    }))
    
    present_days = len(attendance_records)
    
    wage_per_day = 0
    if work_type:
        wage_per_day = float(work_type.get('wage_per_day', 0) or 0)
    
    # If daily_wages records exist (manual overrides), sum them up
    daily_wages_sum = sum(
        float(r.get('wage', 0) or 0)
        for r in db.daily_wages.find({
            'worker_id': worker_id_str,
            'date': {
                '$gte': start,
                '$lte': end
            }
        })
    )
    
    if daily_wages_sum > 0:
        calculated_salary = daily_wages_sum
    else:
        # Calculate based on shifts if present, otherwise just days
        total_shifts = sum(float(r.get('shifts', 1) or 1) for r in attendance_records)
        calculated_salary = total_shifts * wage_per_day

    return {
        'total_work_done': present_days,
        'total_present_days': present_days,
        'wage_type': 'per_day',
        'calculated_salary': round(calculated_salary, 2),
        'role': 'worker',
        'daily_wage': wage_per_day
    }
