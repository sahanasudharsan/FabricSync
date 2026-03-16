"""Work assignment module"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
from datetime import datetime, date
from utils.auth import token_required

assignment_bp = Blueprint('assignments', __name__, url_prefix='/api/assignments')

def get_db():
    from utils.db import get_db
    return get_db()

def _to_json_serializable(obj):
    """Convert date/datetime to ISO string for JSON response."""
    if obj is None:
        return None
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _to_json_serializable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_json_serializable(v) for v in obj]
    return obj

def _parse_date(d):
    """Parse date string to datetime (MongoDB compatible)"""
    if not d:
        return None
    try:
        dt = datetime.fromisoformat(str(d).replace('Z', '+00:00'))
        # Return datetime at midnight UTC for MongoDB compatibility
        return datetime(dt.year, dt.month, dt.day)
    except (ValueError, TypeError):
        return None

@assignment_bp.route('', methods=['GET'])
@token_required
def get_assignments():
    """Get assignments with filters"""
    try:
        db = get_db()
        worker_id = request.args.get('worker_id', '').strip()
        work_type_id = request.args.get('work_type_id', '').strip()
        status = request.args.get('status', '').strip()
        date_str = request.args.get('date', '').strip()
        
        query = {}
        if worker_id and ObjectId.is_valid(worker_id):
            query['worker_id'] = worker_id
        if work_type_id and ObjectId.is_valid(work_type_id):
            query['work_type_id'] = work_type_id
        if status and status in ('completed', 'pending'):
            query['status'] = status
        if date_str:
            d = _parse_date(date_str)
            if d:
                query['date'] = d
        
        assignments = list(db.assignments.find(query).sort([('date', -1), ('created_at', -1)]))
        workers = {str(w['_id']): w for w in db.workers.find({})}
        work_types = {str(w['_id']): w for w in db.work_types.find({})}
        for a in assignments:
            a['id'] = str(a['_id'])
            a['_id'] = str(a['_id'])
            a['worker_name'] = workers.get(a.get('worker_id'), {}).get('name', '-')
            a['work_type_name'] = work_types.get(a.get('work_type_id'), {}).get('work_name', '-')
            if isinstance(a.get('date'), datetime):
                a['date'] = a['date'].date().isoformat()
            elif hasattr(a.get('date'), 'isoformat'):
                a['date'] = a['date'].isoformat()
            if hasattr(a.get('created_at'), 'isoformat'):
                a['created_at'] = a['created_at'].isoformat()
        return jsonify({'success': True, 'data': _to_json_serializable(assignments)}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@assignment_bp.route('', methods=['POST'])
@token_required
def create_assignment():
    """Create work assignment"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'No data provided', 'success': False}), 400
        
        worker_id = (data.get('worker_id') or '').strip()
        work_type_id = (data.get('work_type_id') or '').strip()
        quantity_completed = float(data.get('quantity_completed', 0) or 0)
        d = _parse_date(data.get('date'))
        shift = (data.get('shift') or 'day').strip()
        status = (data.get('status') or 'pending').lower()
        
        if not worker_id or not ObjectId.is_valid(worker_id):
            return jsonify({'message': 'Valid worker_id required', 'success': False}), 400
        if not work_type_id or not ObjectId.is_valid(work_type_id):
            return jsonify({'message': 'Valid work_type_id required', 'success': False}), 400
        if not d:
            return jsonify({'message': 'Valid date required', 'success': False}), 400
        if quantity_completed < 0:
            return jsonify({'message': 'Quantity cannot be negative', 'success': False}), 400
        if status not in ('completed', 'pending'):
            status = 'pending'
        
        db = get_db()
        if not db.workers.find_one({'_id': ObjectId(worker_id)}):
            return jsonify({'message': 'Worker not found', 'success': False}), 404
        if not db.work_types.find_one({'_id': ObjectId(work_type_id)}):
            return jsonify({'message': 'Work type not found', 'success': False}), 404
        
        doc = {
            'worker_id': worker_id,
            'work_type_id': work_type_id,
            'quantity_completed': quantity_completed,
            'date': d,
            'shift': shift,
            'status': status,
            'created_at': datetime.utcnow()
        }
        result = db.assignments.insert_one(doc)
        doc['id'] = str(result.inserted_id)
        doc['_id'] = str(result.inserted_id)
        doc['date'] = d.date().isoformat() if isinstance(d, datetime) else d.isoformat()
        doc['created_at'] = doc['created_at'].isoformat() if hasattr(doc.get('created_at'), 'isoformat') else doc.get('created_at')
        return jsonify({'message': 'Assignment created', 'success': True, 'data': _to_json_serializable(doc)}), 201
    except ValueError:
        return jsonify({'message': 'Invalid quantity', 'success': False}), 400
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@assignment_bp.route('/<id>', methods=['PUT'])
@token_required
def update_assignment(id):
    """Update assignment"""
    try:
        if not ObjectId.is_valid(id):
            return jsonify({'message': 'Invalid ID', 'success': False}), 400
        data = request.get_json()
        db = get_db()
        a = db.assignments.find_one({'_id': ObjectId(id)})
        if not a:
            return jsonify({'message': 'Assignment not found', 'success': False}), 404
        
        updates = {}
        if 'quantity_completed' in data:
            updates['quantity_completed'] = float(data.get('quantity_completed', 0) or 0)
        if 'status' in data and str(data['status']).lower() in ('completed', 'pending'):
            updates['status'] = str(data['status']).lower()
        if 'shift' in data:
            updates['shift'] = str(data.get('shift') or 'day').strip()
        if 'date' in data:
            d = _parse_date(data['date'])
            if d:
                updates['date'] = d
        
        if updates:
            db.assignments.update_one({'_id': ObjectId(id)}, {'$set': updates})
        a = db.assignments.find_one({'_id': ObjectId(id)})
        a['id'] = str(a['_id'])
        a['_id'] = str(a['_id'])
        if hasattr(a.get('date'), 'isoformat'):
            a['date'] = a['date'].isoformat()
        if hasattr(a.get('created_at'), 'isoformat'):
            a['created_at'] = a['created_at'].isoformat()
        return jsonify({'message': 'Assignment updated', 'success': True, 'data': _to_json_serializable(a)}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@assignment_bp.route('/<id>', methods=['DELETE'])
@token_required
def delete_assignment(id):
    """Delete assignment"""
    try:
        if not ObjectId.is_valid(id):
            return jsonify({'message': 'Invalid ID', 'success': False}), 400
        db = get_db()
        result = db.assignments.delete_one({'_id': ObjectId(id)})
        if result.deleted_count == 0:
            return jsonify({'message': 'Assignment not found', 'success': False}), 404
        return jsonify({'message': 'Assignment deleted', 'success': True}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500
