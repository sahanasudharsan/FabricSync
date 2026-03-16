"""Attendance module - prevent duplicate attendance per date"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
from datetime import datetime, date
from utils.auth import token_required

attendance_bp = Blueprint('attendance', __name__, url_prefix='/api/attendance')

def get_db():
    from utils.db import get_db
    return get_db()

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

def _trigger_weekly_wage_calculation():
    """Trigger weekly wage calculation in background"""
    try:
        from routes.wage_routes import calculate_weekly_wages
        # This would be called asynchronously in production
        # For now, we'll just return True
        return True
    except Exception:
        return False

@attendance_bp.route('', methods=['GET'])
@token_required
def get_attendance():
    """Get attendance with filters (date, worker_id, month)"""
    try:
        db = get_db()
        worker_id = request.args.get('worker_id', '').strip()
        d = request.args.get('date', '').strip()
        month = request.args.get('month', '').strip()
        
        query = {}
        if worker_id and ObjectId.is_valid(worker_id):
            query['worker_id'] = worker_id
        if d:
            dt = _parse_date(d)
            if dt:
                query['date'] = dt
        if month:
            try:
                year, m = month.split('-')
                start = datetime(int(year), int(m), 1)
                from calendar import monthrange
                _, last = monthrange(int(year), int(m))
                end = datetime(int(year), int(m), last, 23, 59, 59)
                query['date'] = {'$gte': start, '$lte': end}
            except (ValueError, IndexError):
                pass
        
        records = list(db.attendance.find(query).sort([('date', -1), ('worker_id', 1)]))
        workers = {str(w['_id']): w for w in db.workers.find({})}
        for r in records:
            r['id'] = str(r['_id'])
            r['_id'] = str(r['_id'])
            r['worker_name'] = workers.get(r.get('worker_id'), {}).get('name', '-')
            if isinstance(r.get('date'), (date, datetime)):
                if isinstance(r.get('date'), datetime):
                    r['date'] = r['date'].date().isoformat()
                else:
                    r['date'] = r['date'].isoformat()
        return jsonify({'success': True, 'data': records}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@attendance_bp.route('', methods=['POST'])
@attendance_bp.route('/mark', methods=['POST'])
@token_required
def mark_attendance():
    """Mark attendance - update if exists, create if not (supports optional shift)"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'No data provided', 'success': False}), 400
        
        worker_id = (data.get('worker_id') or '').strip()
        d = _parse_date(data.get('date'))
        status = (data.get('status') or 'present').lower()
        shift = (data.get('shift') or '').strip() or None
        
        if not worker_id or not ObjectId.is_valid(worker_id):
            return jsonify({'message': 'Valid worker_id required', 'success': False}), 400
        if not d:
            return jsonify({'message': 'Valid date required', 'success': False}), 400
        if status not in ('present', 'absent'):
            return jsonify({'message': 'status must be present or absent', 'success': False}), 400
        
        db = get_db()
        if not db.workers.find_one({'_id': ObjectId(worker_id)}):
            return jsonify({'message': 'Worker not found', 'success': False}), 404
        
        # Check if attendance already exists for this worker and date
        existing = db.attendance.find_one({'worker_id': worker_id, 'date': d})
        
        if existing:
            # Update existing record
            result = db.attendance.update_one(
                {'_id': existing['_id']},
                {
                    '$set': {
                        'status': status,
                        'shift': shift,
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            
            if result.modified_count > 0:
                # Get updated record
                updated = db.attendance.find_one({'_id': existing['_id']})
                doc = {
                    'id': str(updated['_id']),
                    '_id': str(updated['_id']),
                    'worker_id': updated['worker_id'],
                    'date': updated['date'].date().isoformat() if isinstance(updated['date'], datetime) else updated['date'].isoformat(),
                    'status': updated['status'],
                    'shift': updated.get('shift'),
                    'created_at': updated['created_at'].isoformat(),
                    'updated_at': updated['updated_at'].isoformat()
                }
                
                # Trigger weekly wage calculation in background
                _trigger_weekly_wage_calculation()
                
                return jsonify({'message': 'Attendance updated', 'success': True, 'data': doc}), 200
            else:
                return jsonify({'message': 'No changes made to attendance', 'success': False}), 400
        else:
            # Create new attendance record
            doc = {
                'worker_id': worker_id,
                'date': d,  # d is now datetime
                'status': status,
                'shift': shift,
                'created_at': datetime.utcnow()
            }
            result = db.attendance.insert_one(doc)
            doc['id'] = str(result.inserted_id)
            doc['_id'] = str(result.inserted_id)
            doc['date'] = d.date().isoformat() if isinstance(d, datetime) else d.isoformat()
            doc['created_at'] = doc['created_at'].isoformat()
            
            # Trigger weekly wage calculation in background
            _trigger_weekly_wage_calculation()
            
            return jsonify({'message': 'Attendance marked', 'success': True, 'data': doc}), 201
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@attendance_bp.route('/bulk', methods=['POST'])
@token_required
def bulk_attendance():
    """Bulk mark attendance for multiple workers on same date (supports optional shift)"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'No data provided', 'success': False}), 400
        
        d = _parse_date(data.get('date'))
        records = data.get('records', [])
        shift = (data.get('shift') or '').strip() or None
        
        if not d:
            return jsonify({'message': 'Valid date required', 'success': False}), 400
        if not records or not isinstance(records, list):
            return jsonify({'message': 'records array required', 'success': False}), 400
        
        db = get_db()
        inserted = 0
        updated = 0
        skipped = 0
        
        for r in records:
            worker_id = (r.get('worker_id') or '').strip()
            status = (r.get('status') or 'present').lower()
            
            if not worker_id or not ObjectId.is_valid(worker_id) or status not in ('present', 'absent'):
                skipped += 1
                continue
                
            if not db.workers.find_one({'_id': ObjectId(worker_id)}):
                skipped += 1
                continue
            
            # Check if attendance already exists for this worker and date
            existing = db.attendance.find_one({'worker_id': worker_id, 'date': d})
            
            if existing:
                # Update existing record instead of skipping
                result = db.attendance.update_one(
                    {'_id': existing['_id']},
                    {
                        '$set': {
                            'status': status,
                            'shift': shift,
                            'updated_at': datetime.utcnow()
                        }
                    }
                )
                if result.modified_count > 0:
                    updated += 1
                else:
                    skipped += 1
            else:
                # Create new attendance record
                db.attendance.insert_one({
                    'worker_id': worker_id,
                    'date': d,
                    'status': status,
                    'shift': shift,
                    'created_at': datetime.utcnow()
                })
                inserted += 1
        
        # Trigger weekly wage calculation in background if any attendance was marked/updated
        if (inserted + updated) > 0:
            _trigger_weekly_wage_calculation()
        
        return jsonify({
            'message': f'Inserted {inserted}, Updated {updated}, Skipped {skipped} attendance records',
            'success': True,
            'inserted': inserted,
            'updated': updated,
            'skipped': skipped
        }), 201
            
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@attendance_bp.route('/<id>', methods=['DELETE'])
@token_required
def delete_attendance(id):
    """Delete attendance record"""
    try:
        if not ObjectId.is_valid(id):
            return jsonify({'message': 'Invalid ID', 'success': False}), 400
        db = get_db()
        result = db.attendance.delete_one({'_id': ObjectId(id)})
        if result.deleted_count == 0:
            return jsonify({'message': 'Attendance not found', 'success': False}), 404
        return jsonify({'message': 'Attendance deleted', 'success': True}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500
