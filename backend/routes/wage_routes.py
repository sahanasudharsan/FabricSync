"""Weekly Wage tracking and calculation"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
from datetime import datetime, timedelta
from utils.auth import token_required

wage_bp = Blueprint('weekly_wages', __name__, url_prefix='/api/weekly-wages')

def get_db():
    from utils.db import get_db
    return get_db()

# Work type wage rates as specified
WORK_TYPE_RATES = {
    'Mixing': 400,
    'Blow Room': 400,
    'Carding': 400,
    'Drawing': 400,
    'Simplex': 400,
    'Spinning': 390,
    'Winding': 390,
    'Packing': 300
}

def get_wage_rate_for_work_type(work_type_name):
    """Get wage rate for a work type based on predefined rates"""
    return WORK_TYPE_RATES.get(work_type_name, 0)

@wage_bp.route('/calculate', methods=['POST'])
@token_required
def calculate_weekly_wages():
    """Automatically calculate weekly wages based on attendance and work types"""
    try:
        data = request.get_json() or {}
        date_str = data.get('date') or request.args.get('date')
        
        if date_str:
            try:
                base_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            except (ValueError, TypeError):
                base_date = datetime.utcnow()
        else:
            base_date = datetime.utcnow()
        
        # Get start and end of week (Monday to Sunday)
        start_of_week = base_date - timedelta(days=base_date.weekday())
        start_of_week = datetime(start_of_week.year, start_of_week.month, start_of_week.day)
        end_of_week = start_of_week + timedelta(days=6, hours=23, minutes=59, seconds=59)
        
        db = get_db()
        
        # Get all active workers
        workers = list(db.workers.find({'status': 'active'}))
        
        # Get work types for wage rates
        work_types = {str(wt['_id']): wt for wt in db.work_types.find({})}
        
        calculated_wages = []
        
        for worker in workers:
            worker_id = str(worker['_id'])
            
            # Get worker's work type
            work_type_id = worker.get('assigned_work_type')
            if not work_type_id:
                continue
                
            work_type = work_types.get(work_type_id)
            if not work_type:
                continue
                
            # Get attendance for this worker in the week
            attendance_records = list(db.attendance.find({
                'worker_id': worker_id,
                'date': {'$gte': start_of_week, '$lte': end_of_week},
                'status': 'present'
            }))
            
            shifts_worked = len(attendance_records)
            
            # Get wage rate based on work type name
            wage_rate = get_wage_rate_for_work_type(work_type.get('work_name', ''))
            if wage_rate == 0:
                # Fallback to work_type's wage_per_day if not in predefined rates
                wage_rate = float(work_type.get('wage_per_day', 0) or 0)
            
            weekly_wages = round(shifts_worked * wage_rate, 2)
            
            # Check if record already exists for this week
            existing = db.weekly_wages.find_one({
                'worker_id': worker_id,
                'week_start': start_of_week,
                'week_end': end_of_week
            })
            
            wage_record = {
                'worker_id': worker_id,
                'work_type_id': work_type_id,
                'shifts_performed': shifts_worked,
                'salary_per_shift': wage_rate,
                'weekly_wages': weekly_wages,
                'week_start': start_of_week,
                'week_end': end_of_week,
                'updated_at': datetime.utcnow()
            }
            
            if existing:
                # Update existing record
                db.weekly_wages.update_one(
                    {'_id': existing['_id']},
                    {'$set': wage_record}
                )
                wage_record['id'] = str(existing['_id'])
            else:
                # Create new record
                wage_record['created_at'] = datetime.utcnow()
                result = db.weekly_wages.insert_one(wage_record)
                wage_record['id'] = str(result.inserted_id)
            
            # Add worker and work type names for response
            wage_record['worker_name'] = worker.get('name', '-')
            wage_record['work_type_name'] = work_type.get('work_name', '-')
            
            calculated_wages.append(wage_record)
        
        return jsonify({
            'success': True,
            'message': f'Calculated weekly wages for {len(calculated_wages)} workers',
            'data': calculated_wages,
            'week_period': {
                'start': start_of_week.date().isoformat(),
                'end': end_of_week.date().isoformat()
            }
        }), 200
        
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@wage_bp.route('', methods=['GET'])
@token_required
def get_weekly_wages():
    """Get weekly wage records"""
    try:
        db = get_db()
        worker_id = request.args.get('worker_id')
        
        query = {}
        if worker_id and ObjectId.is_valid(worker_id):
            query['worker_id'] = worker_id
            
        records = list(db.weekly_wages.find(query).sort('created_at', -1))
        
        # Join with worker and work type names
        workers = {str(w['_id']): w['name'] for w in db.workers.find({})}
        work_types = {str(wt['_id']): wt['work_name'] for wt in db.work_types.find({})}
        
        for r in records:
            r['id'] = str(r['_id'])
            r['_id'] = str(r['_id'])
            r['worker_name'] = workers.get(r.get('worker_id'), '-')
            r['work_type_name'] = work_types.get(r.get('work_type_id'), '-')
            if hasattr(r.get('created_at'), 'isoformat'):
                r['created_at'] = r['created_at'].isoformat()
                
        return jsonify({'success': True, 'data': records}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@wage_bp.route('', methods=['POST'])
@token_required
def create_weekly_wage():
    """Create weekly wage record"""
    try:
        data = request.get_json()
        worker_id = data.get('worker_id')
        work_type_id = data.get('work_type_id')
        shifts = float(data.get('shifts_performed', 0))
        salary_per_shift = float(data.get('salary_per_shift', 0))
        
        if not worker_id or not ObjectId.is_valid(worker_id):
            return jsonify({'message': 'Valid worker_id required', 'success': False}), 400
        if not work_type_id or not ObjectId.is_valid(work_type_id):
            return jsonify({'message': 'Valid work_type_id required', 'success': False}), 400
            
        weekly_wages = round(shifts * salary_per_shift, 2)
        
        doc = {
            'worker_id': worker_id,
            'work_type_id': work_type_id,
            'shifts_performed': shifts,
            'salary_per_shift': salary_per_shift,
            'weekly_wages': weekly_wages,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        db = get_db()
        result = db.weekly_wages.insert_one(doc)
        doc['id'] = str(result.inserted_id)
        doc['_id'] = str(result.inserted_id)
        doc['created_at'] = doc['created_at'].isoformat()
        
        return jsonify({'success': True, 'data': doc}), 201
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@wage_bp.route('/<id>', methods=['PUT'])
@token_required
def update_weekly_wage(id):
    """Update weekly wage record"""
    try:
        if not ObjectId.is_valid(id):
            return jsonify({'message': 'Invalid ID', 'success': False}), 400
            
        data = request.get_json()
        db = get_db()
        
        updates = {'updated_at': datetime.utcnow()}
        if 'shifts_performed' in data or 'salary_per_shift' in data:
            # Need current values to re-calculate
            existing = db.weekly_wages.find_one({'_id': ObjectId(id)})
            if not existing:
                return jsonify({'message': 'Record not found', 'success': False}), 404
            
            shifts = float(data.get('shifts_performed', existing.get('shifts_performed', 0)))
            salary = float(data.get('salary_per_shift', existing.get('salary_per_shift', 0)))
            updates['shifts_performed'] = shifts
            updates['salary_per_shift'] = salary
            updates['weekly_wages'] = round(shifts * salary, 2)
        
        if 'work_type_id' in data and ObjectId.is_valid(data['work_type_id']):
            updates['work_type_id'] = data['work_type_id']
            
        db.weekly_wages.update_one({'_id': ObjectId(id)}, {'$set': updates})
        return jsonify({'success': True, 'message': 'Record updated'}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@wage_bp.route('/<id>', methods=['DELETE'])
@token_required
def delete_weekly_wage(id):
    """Delete weekly wage record"""
    try:
        if not ObjectId.is_valid(id):
            return jsonify({'message': 'Invalid ID', 'success': False}), 400
        db = get_db()
        db.weekly_wages.delete_one({'_id': ObjectId(id)})
        return jsonify({'success': True, 'message': 'Record deleted'}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500
