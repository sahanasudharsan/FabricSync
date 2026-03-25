"""Worker management routes"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
from datetime import datetime
from utils.auth import token_required

worker_bp = Blueprint('workers', __name__, url_prefix='/api/workers')

def get_db():
    from utils.db import get_db
    return get_db()

def _serialize_worker(w):
    w['id'] = str(w['_id'])
    w['_id'] = str(w['_id'])
    return w

@worker_bp.route('', methods=['GET'])
@token_required
def get_workers():
    """Get all workers with optional search/filter"""
    try:
        db = get_db()
        search = (request.args.get('search') or '').strip()
        status = request.args.get('status', '').strip()
        work_type_id = request.args.get('work_type_id', '').strip()
        
        query = {}
        if search:
            query['$or'] = [
                {'name': {'$regex': search, '$options': 'i'}},
                {'phone': {'$regex': search, '$options': 'i'}},
                {'skill_type': {'$regex': search, '$options': 'i'}},
                {'preferred_work': {'$regex': search, '$options': 'i'}}
            ]
        if status and status in ('active', 'inactive'):
            query['status'] = status
        if work_type_id and ObjectId.is_valid(work_type_id):
            query['assigned_work_type'] = work_type_id
        
        workers = list(db.workers.find(query).sort('name', 1))
        work_types = {str(w['_id']): w for w in db.work_types.find({})}
        for w in workers:
            _serialize_worker(w)
            w['work_type_name'] = work_types.get(w.get('assigned_work_type'), {}).get('work_name', '-')
            w['work_type_wage'] = float(work_types.get(w.get('assigned_work_type'), {}).get('wage_per_day', 0) or 0)
            
            # Calculate weekly salary (current week)
            from datetime import timedelta
            now = datetime.utcnow()
            start_of_week = now - timedelta(days=now.weekday())
            start_of_week = datetime(start_of_week.year, start_of_week.month, start_of_week.day)
            
            attendance_count = db.attendance.count_documents({
                'worker_id': str(w['_id']),
                'date': {'$gte': start_of_week},
                'status': 'present'
            })
            # Also account for shifts if they exist in those records
            attendance_records = list(db.attendance.find({
                'worker_id': str(w['_id']),
                'date': {'$gte': start_of_week},
                'status': 'present'
            }))
            total_shifts = sum(float(r.get('shifts', 1) or 1) for r in attendance_records)
            w['weekly_salary'] = round(total_shifts * w['work_type_wage'], 2)
            w['days_present_week'] = len(attendance_records)

            w.setdefault('preferred_work', w.get('skill_type', ''))
            w.setdefault('shift_preference', '')
            w.setdefault('role', 'worker')
        return jsonify({'success': True, 'data': workers}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@worker_bp.route('/<id>', methods=['GET'])
@token_required
def get_worker(id):
    """Get single worker"""
    try:
        if not ObjectId.is_valid(id):
            return jsonify({'message': 'Invalid ID', 'success': False}), 400
        db = get_db()
        w = db.workers.find_one({'_id': ObjectId(id)})
        if not w:
            return jsonify({'message': 'Worker not found', 'success': False}), 404
        _serialize_worker(w)
        w.setdefault('preferred_work', w.get('skill_type', ''))
        w.setdefault('shift_preference', '')
        w.setdefault('role', 'worker')
        if w.get('assigned_work_type'):
            wt = db.work_types.find_one({'_id': ObjectId(w['assigned_work_type'])})
            w['work_type_name'] = wt['work_name'] if wt else '-'
        return jsonify({'success': True, 'data': w}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@worker_bp.route('', methods=['POST'])
@token_required
def create_worker():
    """Create worker"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'No data provided', 'success': False}), 400
        
        name = (data.get('name') or '').strip()
        phone = (data.get('phone') or '').strip()
        skill_type = (data.get('skill_type') or '').strip()
        assigned_work_type = (data.get('assigned_work_type') or '').strip()
        preferred_work = (data.get('preferred_work') or skill_type).strip()
        shift_preference = (data.get('shift_preference') or '').strip() or None
        role = (data.get('role') or 'worker').lower()
        joining_date = data.get('joining_date')
        status = (data.get('status') or 'active').lower()
        
        if not name:
            return jsonify({'message': 'Name is required', 'success': False}), 400
        
        if status not in ('active', 'inactive'):
            status = 'active'
        if role not in ('worker', 'supervisor', 'fitter'):
            role = 'worker'
        
        joining_dt = None
        if joining_date:
            try:
                joining_dt = datetime.fromisoformat(joining_date.replace('Z', '+00:00'))
                if joining_dt.tzinfo:
                    joining_dt = joining_dt.replace(tzinfo=None)
            except (ValueError, TypeError):
                pass
        
        db = get_db()
        if assigned_work_type and ObjectId.is_valid(assigned_work_type):
            wt = db.work_types.find_one({'_id': ObjectId(assigned_work_type)})
            if not wt:
                return jsonify({'message': 'Invalid work type', 'success': False}), 400
            preferred_work = preferred_work or wt.get('work_name', '')
        else:
            assigned_work_type = None

        doc = {
            'name': name,
            'phone': phone,
            'skill_type': skill_type,
            'preferred_work': preferred_work or '',
            'assigned_work_type': assigned_work_type,
            'shift_preference': shift_preference,
            'role': role,
            'joining_date': joining_dt or datetime.utcnow(),
            'status': status,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        result = db.workers.insert_one(doc)
        _serialize_worker(doc)
        doc['joining_date'] = doc['joining_date'].isoformat() if hasattr(doc['joining_date'], 'isoformat') else str(doc['joining_date'])
        for key in ('created_at', 'updated_at'):
            if hasattr(doc.get(key), 'isoformat'):
                doc[key] = doc[key].isoformat()
        return jsonify({'message': 'Worker created', 'success': True, 'data': doc}), 201
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@worker_bp.route('/<id>', methods=['PUT'])
@token_required
def update_worker(id):
    """Update worker"""
    try:
        if not ObjectId.is_valid(id):
            return jsonify({'message': 'Invalid ID', 'success': False}), 400
        data = request.get_json()
        db = get_db()
        w = db.workers.find_one({'_id': ObjectId(id)})
        if not w:
            return jsonify({'message': 'Worker not found', 'success': False}), 404
        
        updates = {'updated_at': datetime.utcnow()}
        for key in ('name', 'phone', 'skill_type', 'assigned_work_type', 'preferred_work', 'shift_preference', 'role', 'status'):
            if key in data:
                if key == 'status' and str(data[key]).lower() in ('active', 'inactive'):
                    updates[key] = str(data[key]).lower()
                elif key == 'assigned_work_type':
                    val = (data.get(key) or '').strip()
                    updates[key] = val if val and ObjectId.is_valid(val) else None
                elif key == 'role' and str(data.get(key)).lower() in ('worker', 'supervisor', 'fitter'):
                    updates[key] = str(data[key]).lower()
                elif key == 'shift_preference':
                    updates[key] = (data.get(key) or '').strip() or None
                else:
                    updates[key] = str(data.get(key) or '').strip()
        if 'joining_date' in data and data['joining_date']:
            try:
                d = datetime.fromisoformat(str(data['joining_date']).replace('Z', '+00:00'))
                updates['joining_date'] = d.replace(tzinfo=None) if d.tzinfo else d
            except (ValueError, TypeError):
                pass
        
        db.workers.update_one({'_id': ObjectId(id)}, {'$set': updates})
        w = db.workers.find_one({'_id': ObjectId(id)})
        _serialize_worker(w)
        if isinstance(w.get('joining_date'), datetime):
            w['joining_date'] = w['joining_date'].isoformat()
        for key in ('created_at', 'updated_at'):
            if hasattr(w.get(key), 'isoformat'):
                w[key] = w[key].isoformat()
        return jsonify({'message': 'Worker updated', 'success': True, 'data': w}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@worker_bp.route('/<id>', methods=['DELETE'])
@token_required
def delete_worker(id):
    """Delete worker"""
    try:
        if not ObjectId.is_valid(id):
            return jsonify({'message': 'Invalid ID', 'success': False}), 400
        db = get_db()
        result = db.workers.delete_one({'_id': ObjectId(id)})
        if result.deleted_count == 0:
            return jsonify({'message': 'Worker not found', 'success': False}), 404
        return jsonify({'message': 'Worker deleted', 'success': True}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500
