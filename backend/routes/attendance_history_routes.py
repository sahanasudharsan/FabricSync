"""Attendance History module - comprehensive attendance tracking and reporting"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
from datetime import datetime, date, timedelta
from calendar import monthrange
from utils.auth import token_required

attendance_history_bp = Blueprint('attendance_history', __name__, url_prefix='/api/attendance-history')

def get_db():
    from utils.db import get_db
    return get_db()

def _parse_date(d):
    """Parse date string to datetime (MongoDB compatible)"""
    if not d:
        return None
    try:
        dt = datetime.fromisoformat(str(d).replace('Z', '+00:00'))
        return datetime(dt.year, dt.month, dt.day)
    except (ValueError, TypeError):
        return None

@attendance_history_bp.route('', methods=['GET'])
@token_required
def get_attendance_history():
    """Get attendance history with filters (date range, employee, status, page)"""
    try:
        db = get_db()
        
        # Query parameters
        worker_id = request.args.get('worker_id', '').strip()
        start_date = request.args.get('start_date', '').strip()
        end_date = request.args.get('end_date', '').strip()
        status = request.args.get('status', '').strip().lower()
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        
        query = {}
        
        # Build query
        if worker_id and ObjectId.is_valid(worker_id):
            query['worker_id'] = worker_id
            
        if start_date:
            start_dt = _parse_date(start_date)
            if start_dt:
                query.setdefault('date', {})['$gte'] = start_dt
                
        if end_date:
            end_dt = _parse_date(end_date)
            if end_dt:
                query.setdefault('date', {})['$lte'] = end_dt
                
        if status and status in ('present', 'absent'):
            query['status'] = status
        
        # Get total count for pagination
        total = db.attendance.count_documents(query)
        
        # Get paginated results
        skip = (page - 1) * limit
        records = list(db.attendance.find(query)
                      .sort([('date', -1), ('worker_id', 1)])
                      .skip(skip)
                      .limit(limit))
        
        # Join with worker names
        workers = {str(w['_id']): w for w in db.workers.find({})}
        
        for r in records:
            r['id'] = str(r['_id'])
            r['_id'] = str(r['_id'])
            r['worker_name'] = workers.get(r.get('worker_id'), {}).get('name', '-')
            r['worker_status'] = workers.get(r.get('worker_id'), {}).get('status', '-')
            if isinstance(r.get('date'), (date, datetime)):
                if isinstance(r.get('date'), datetime):
                    r['date'] = r['date'].date().isoformat()
                else:
                    r['date'] = r['date'].isoformat()
            if hasattr(r.get('created_at'), 'isoformat'):
                r['created_at'] = r['created_at'].isoformat()
                
        return jsonify({
            'success': True,
            'data': records,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total,
                'pages': (total + limit - 1) // limit
            }
        }), 200
        
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@attendance_history_bp.route('/summary', methods=['GET'])
@token_required
def get_attendance_summary():
    """Get attendance summary statistics"""
    try:
        db = get_db()
        
        # Query parameters
        start_date = request.args.get('start_date', '').strip()
        end_date = request.args.get('end_date', '').strip()
        worker_id = request.args.get('worker_id', '').strip()
        
        query = {}
        
        if start_date:
            start_dt = _parse_date(start_date)
            if start_dt:
                query['date'] = {'$gte': start_dt}
                
        if end_date:
            end_dt = _parse_date(end_date)
            if end_dt:
                if 'date' in query:
                    query['date']['$lte'] = end_dt
                else:
                    query['date'] = {'$lte': end_dt}
                    
        if worker_id and ObjectId.is_valid(worker_id):
            query['worker_id'] = worker_id
        
        # Get attendance records
        records = list(db.attendance.find(query))
        
        # Calculate statistics
        total_days = len(set(r['date'].date() if isinstance(r['date'], datetime) else datetime.fromisoformat(r['date']).date() for r in records))
        total_records = len(records)
        present_count = len([r for r in records if r['status'] == 'present'])
        absent_count = len([r for r in records if r['status'] == 'absent'])
        
        # Worker-wise statistics
        worker_stats = {}
        for r in records:
            worker_id = r['worker_id']
            if worker_id not in worker_stats:
                worker_stats[worker_id] = {'present': 0, 'absent': 0, 'total': 0}
            worker_stats[worker_id][r['status']] += 1
            worker_stats[worker_id]['total'] += 1
        
        # Get worker names
        workers = {str(w['_id']): w for w in db.workers.find({})}
        worker_summary = []
        for worker_id, stats in worker_stats.items():
            worker_summary.append({
                'worker_id': worker_id,
                'worker_name': workers.get(worker_id, {}).get('name', '-'),
                'present_days': stats['present'],
                'absent_days': stats['absent'],
                'total_days': stats['total'],
                'attendance_percentage': round((stats['present'] / stats['total']) * 100, 2) if stats['total'] > 0 else 0
            })
        
        return jsonify({
            'success': True,
            'data': {
                'total_records': total_records,
                'total_days': total_days,
                'present_count': present_count,
                'absent_count': absent_count,
                'overall_percentage': round((present_count / total_records) * 100, 2) if total_records > 0 else 0,
                'worker_summary': worker_summary
            }
        }), 200
        
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@attendance_history_bp.route('/monthly', methods=['GET'])
@token_required
def get_monthly_attendance():
    """Get monthly attendance overview"""
    try:
        db = get_db()
        
        year = int(request.args.get('year', datetime.now().year))
        month = int(request.args.get('month', datetime.now().month))
        
        # Calculate month range
        start_date = datetime(year, month, 1)
        _, last_day = monthrange(year, month)
        end_date = datetime(year, month, last_day, 23, 59, 59)
        
        query = {
            'date': {'$gte': start_date, '$lte': end_date}
        }
        
        records = list(db.attendance.find(query))
        workers = {str(w['_id']): w for w in db.workers.find({})}
        
        # Group by date and worker
        daily_data = {}
        for r in records:
            date_key = r['date'].date().isoformat() if isinstance(r['date'], datetime) else r['date']
            if date_key not in daily_data:
                daily_data[date_key] = {'present': 0, 'absent': 0, 'total': 0}
            daily_data[date_key][r['status']] += 1
            daily_data[date_key]['total'] += 1
        
        # Convert to list format
        monthly_data = []
        for date_key, stats in sorted(daily_data.items()):
            monthly_data.append({
                'date': date_key,
                'present': stats['present'],
                'absent': stats['absent'],
                'total': stats['total'],
                'percentage': round((stats['present'] / stats['total']) * 100, 2) if stats['total'] > 0 else 0
            })
        
        return jsonify({
            'success': True,
            'data': {
                'year': year,
                'month': month,
                'daily_data': monthly_data
            }
        }), 200
        
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500
