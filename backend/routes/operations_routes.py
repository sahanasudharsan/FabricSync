"""Operations: work assignment, wage calculation"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
from datetime import datetime
from collections import defaultdict
from utils.auth import token_required

ops_bp = Blueprint('operations', __name__, url_prefix='/api')

def get_db():
    from utils.db import get_db
    return get_db()

def _parse_date(d):
    if not d:
        return None
    try:
        dt = datetime.fromisoformat(str(d).replace('Z', '+00:00'))
        return datetime(dt.year, dt.month, dt.day)
    except (ValueError, TypeError):
        return None

SHIFTS = ['shift1', 'shift2', 'shift3']
SHIFT_LABELS = {'shift1': '6AM – 2PM', 'shift2': '2PM – 10PM', 'shift3': '10PM – 6AM'}

@ops_bp.route('/work/assign', methods=['POST'])
@token_required
def work_assign():
    """
    Auto-assign present workers to shifts and work types.
    Uses worker preferred_work / assigned_work_type and shift_preference.
    Creates assignments and daily_wages records.
    """
    try:
        data = request.get_json() or {}
        date_str = data.get('date') or request.args.get('date', '')
        d = _parse_date(date_str)
        if not d:
            return jsonify({'message': 'Valid date required (YYYY-MM-DD)', 'success': False}), 400

        db = get_db()
        # Get present workers for this date
        present = list(db.attendance.find({
            'date': d,
            'status': 'present'
        }))
        worker_ids = [r['worker_id'] for r in present]
        if not worker_ids:
            return jsonify({'message': 'No present workers for this date. Mark attendance first.', 'success': False}), 400

        workers = {str(w['_id']): w for w in db.workers.find({'_id': {'$in': [ObjectId(wid) for wid in worker_ids if ObjectId.is_valid(wid)]}})}
        work_types = {str(wt['_id']): wt for wt in db.work_types.find({})}
        work_types_by_name = {wt.get('work_name', '').lower(): wt for wt in work_types.values()}

        # Build shift per worker from attendance
        worker_shift = {}
        for r in present:
            worker_shift[r['worker_id']] = r.get('shift') or 'shift1'

        # Distribute workers across shifts (shift1, shift2, shift3)
        shift_counts = defaultdict(int)
        assignments_created = 0
        wages_created = 0

        for wid in worker_ids:
            w = workers.get(wid)
            if not w or w.get('status') != 'active':
                continue
            shift = worker_shift.get(wid) or w.get('shift_preference') or 'shift1'
            if shift not in SHIFTS:
                shift = 'shift1'

            work_type_id = w.get('assigned_work_type')
            work_type = work_types.get(work_type_id) if work_type_id else None
            preferred = (w.get('preferred_work') or '').strip().lower()
            if not work_type and preferred:
                work_type = work_types_by_name.get(preferred)
                work_type_id = str(work_type['_id']) if work_type else None

            if not work_type:
                wt_list = list(work_types.values())
                work_type = wt_list[0] if wt_list else None
                work_type_id = str(work_type['_id']) if work_type else None

            if not work_type:
                continue

            wage_per_day = float(work_type.get('wage_per_day', 0) or 0)
            work_name = work_type.get('work_name', '')

            # Skip if already assigned for this date
            existing = db.assignments.find_one({'worker_id': wid, 'date': d})
            if existing:
                continue

            db.assignments.insert_one({
                'worker_id': wid,
                'work_type_id': work_type_id,
                'quantity_completed': 0,
                'date': d,
                'shift': shift,
                'status': 'pending',
                'created_at': datetime.utcnow()
            })
            assignments_created += 1

            # Create daily_wage record
            existing_wage = db.daily_wages.find_one({'worker_id': wid, 'date': d})
            if not existing_wage:
                db.daily_wages.insert_one({
                    'worker_id': wid,
                    'worker_name': w.get('name', '-'),
                    'date': d,
                    'work_type': work_name,
                    'work_type_id': work_type_id,
                    'shift': shift,
                    'wage': wage_per_day,
                    'created_at': datetime.utcnow()
                })
                wages_created += 1

        return jsonify({
            'message': f'Assigned {assignments_created} workers, created {wages_created} wage records',
            'success': True,
            'assignments_created': assignments_created,
            'wages_created': wages_created
        }), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@ops_bp.route('/wages/calculate', methods=['POST'])
@token_required
def wages_calculate():
    """
    Calculate and store daily_wages for present workers on a date.
    Uses assignments if exist, else worker's assigned_work_type wage.
    """
    try:
        data = request.get_json() or {}
        date_str = data.get('date') or request.args.get('date', '')
        d = _parse_date(date_str)
        if not d:
            return jsonify({'message': 'Valid date required', 'success': False}), 400

        db = get_db()
        present = list(db.attendance.find({'date': d, 'status': 'present'}))
        worker_ids = [r['worker_id'] for r in present]
        workers = {str(w['_id']): w for w in db.workers.find({})}
        work_types = {str(wt['_id']): wt for wt in db.work_types.find({})}

        created = 0
        for r in present:
            wid = r['worker_id']
            w = workers.get(wid)
            if not w or (w.get('role') or 'worker') not in ('worker',):
                continue
            if db.daily_wages.find_one({'worker_id': wid, 'date': d}):
                continue

            wage_val = 0
            work_name = ''
            work_type_id = None
            shift = r.get('shift') or 'shift1'

            assign = db.assignments.find_one({'worker_id': wid, 'date': d})
            if assign and assign.get('work_type_id'):
                wt = work_types.get(assign['work_type_id'])
                if wt:
                    wage_val = float(wt.get('wage_per_day', 0) or 0)
                    work_name = wt.get('work_name', '')
                    work_type_id = assign['work_type_id']
                    shift = assign.get('shift', shift)
            else:
                wt_id = w.get('assigned_work_type')
                if wt_id:
                    wt = work_types.get(wt_id)
                    if wt:
                        wage_val = float(wt.get('wage_per_day', 0) or 0)
                        work_name = wt.get('work_name', '')
                        work_type_id = wt_id

            if wage_val > 0:
                db.daily_wages.insert_one({
                    'worker_id': wid,
                    'worker_name': w.get('name', '-'),
                    'date': d,
                    'work_type': work_name,
                    'work_type_id': work_type_id,
                    'shift': shift,
                    'wage': wage_val,
                    'created_at': datetime.utcnow()
                })
                created += 1

        return jsonify({'message': f'Calculated {created} daily wage records', 'success': True, 'created': created}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500
