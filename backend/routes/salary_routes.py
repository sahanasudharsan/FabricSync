"""Salary module - auto-calculated from attendance & assignments"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
from datetime import datetime, date
from calendar import monthrange
from utils.auth import token_required
from controllers.salary_controller import calculate_salary_for_worker

salary_bp = Blueprint('salary', __name__, url_prefix='/api/salary')

def get_db():
    from utils.db import get_db
    return get_db()

@salary_bp.route('', methods=['GET'])
@token_required
def get_salaries():
    """Get salary records - filter by month, worker"""
    try:
        db = get_db()
        worker_id = request.args.get('worker_id', '').strip()
        month_str = request.args.get('month', '').strip()
        
        query = {}
        if worker_id and ObjectId.is_valid(worker_id):
            query['worker_id'] = worker_id
        if month_str:
            try:
                year, m = month_str.split('-')
                query['month'] = int(m)
                query['year'] = int(year)
            except (ValueError, IndexError):
                pass
        
        records = list(db.salaries.find(query).sort([('year', -1), ('month', -1)]))
        workers = {str(w['_id']): w for w in db.workers.find({})}
        for r in records:
            r['id'] = str(r['_id'])
            r['_id'] = str(r['_id'])
            r['worker_name'] = workers.get(r.get('worker_id'), {}).get('name', '-')
            for key in ('created_at', 'updated_at'):
                if hasattr(r.get(key), 'isoformat'):
                    r[key] = r[key].isoformat()
        return jsonify({'success': True, 'data': records}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@salary_bp.route('/calculate', methods=['POST'])
@salary_bp.route('/monthly', methods=['POST'])
@token_required
def calculate_salaries():
    """
    Calculate and store salaries for a month.
    Auto-calculates for all active workers.
    """
    try:
        data = request.get_json() or {}
        month_str = data.get('month') or request.args.get('month', '')
        if not month_str:
            now = date.today()
            month_str = f"{now.year}-{now.month:02d}"
        
        try:
            parts = month_str.split('-')
            year = int(parts[0])
            month = int(parts[1])
            if month < 1 or month > 12:
                raise ValueError('Invalid month')
        except (ValueError, IndexError):
            return jsonify({'message': 'Invalid month format (use YYYY-MM)', 'success': False}), 400
        
        db = get_db()
        workers = list(db.workers.find({'status': 'active'}))
        created = 0
        updated = 0
        
        def _get_adj(d, key, worker_id):
            val = data.get(key)
            if isinstance(val, dict):
                return float(val.get(worker_id, 0) or 0)
            return 0.0

        for worker in workers:
            wid = str(worker['_id'])
            existing = db.salaries.find_one({'worker_id': wid, 'year': year, 'month': month})
            calc = calculate_salary_for_worker(db, worker['_id'], year, month)
            if not calc:
                continue

            overtime = _get_adj(data, 'overtime', wid)
            bonus = _get_adj(data, 'bonus', wid)
            deductions = _get_adj(data, 'deductions', wid)

            if existing:
                overtime = float(existing.get('overtime', 0) or 0) or overtime
                bonus = float(existing.get('bonus', 0) or 0) or bonus
                deductions = float(existing.get('deductions', 0) or 0) or deductions
            
            final_salary = max(0, calc['calculated_salary'] + overtime + bonus - deductions)
            
            doc = {
                'worker_id': wid,
                'employee_name': worker.get('name', '-'),
                'role': calc.get('role', 'worker'),
                'year': year,
                'month': month,
                'total_work_done': calc['total_work_done'],
                'total_present_days': calc['total_present_days'],
                'wage_type': calc['wage_type'],
                'calculated_salary': calc['calculated_salary'],
                'overtime': overtime,
                'bonus': bonus,
                'deductions': deductions,
                'final_salary': round(final_salary, 2),
                'total_salary': round(final_salary, 2),
                'updated_at': datetime.utcnow()
            }
            
            if existing:
                db.salaries.update_one(
                    {'_id': existing['_id']},
                    {'$set': doc}
                )
                updated += 1
            else:
                doc['created_at'] = datetime.utcnow()
                db.salaries.insert_one(doc)
                created += 1
        
        if not workers:
            return jsonify({
                'message': 'No active workers found. Add workers and set status to "active" to calculate salaries.',
                'success': True,
                'created': 0,
                'updated': 0
            }), 200

        return jsonify({
            'message': f'Calculated salaries: {created} created, {updated} updated',
            'success': True,
            'created': created,
            'updated': updated
        }), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@salary_bp.route('/payroll/weekly', methods=['GET'])
@token_required
def get_weekly_payroll():
    """Get total payroll for all employees for the current or specified week"""
    try:
        db = get_db()
        d_str = request.args.get('date')
        if d_str:
            try:
                dt = datetime.fromisoformat(d_str.replace('Z', '+00:00'))
            except (ValueError, TypeError):
                dt = datetime.utcnow()
        else:
            dt = datetime.utcnow()

        from datetime import timedelta
        start_of_week = dt - timedelta(days=dt.weekday()) # Monday
        start_of_week = datetime(start_of_week.year, start_of_week.month, start_of_week.day)
        end_of_week = start_of_week + timedelta(days=6)

        workers = list(db.workers.find({'status': 'active'}))
        payroll_data = []
        total_payroll = 0

        for worker in workers:
            wid_str = str(worker['_id'])
            
            # Get attendance for the week - query each day individually
            attendance_records = []
            for day_offset in range(7):  # 0 to 6 for each day of the week
                current_day = start_of_week + timedelta(days=day_offset)
                day_attendance = list(db.attendance.find({
                    'worker_id': wid_str,
                    'date': current_day,
                    'status': 'present'
                }))
                attendance_records.extend(day_attendance)
            
            days_present = len(attendance_records)
            total_shifts = sum(float(r.get('shifts', 1) or 1) for r in attendance_records)
            
            # Get wage
            work_type_id = worker.get('assigned_work_type')
            wage_per_day = 0
            if work_type_id and ObjectId.is_valid(str(work_type_id)):
                wt = db.work_types.find_one({'_id': ObjectId(work_type_id)})
                if wt:
                    wage_per_day = float(wt.get('wage_per_day', 0) or 0)
            
            weekly_salary = total_shifts * wage_per_day
            total_payroll += weekly_salary
            
            payroll_data.append({
                'id': wid_str,
                'name': worker.get('name'),
                'preferred_work': worker.get('preferred_work'),
                'daily_wage': wage_per_day,
                'days_present': days_present,
                'total_shifts': total_shifts,
                'weekly_salary': round(weekly_salary, 2)
            })

        return jsonify({
            'success': True,
            'data': {
                'employees': payroll_data,
                'total_payroll': round(total_payroll, 2),
                'start_of_week': start_of_week.date().isoformat(),
                'end_of_week': end_of_week.date().isoformat()
            }
        }), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@salary_bp.route('/<id>', methods=['PUT'])
@token_required
def update_salary(id):
    """Update overtime, bonus, deductions for a salary record"""
    try:
        if not ObjectId.is_valid(id):
            return jsonify({'message': 'Invalid ID', 'success': False}), 400
        data = request.get_json()
        db = get_db()
        s = db.salaries.find_one({'_id': ObjectId(id)})
        if not s:
            return jsonify({'message': 'Salary record not found', 'success': False}), 404
        
        updates = {}
        if 'overtime' in data:
            updates['overtime'] = float(data.get('overtime', 0) or 0)
        if 'bonus' in data:
            updates['bonus'] = float(data.get('bonus', 0) or 0)
        if 'deductions' in data:
            updates['deductions'] = float(data.get('deductions', 0) or 0)
        
        if updates:
            base = s.get('calculated_salary', 0) or 0
            ot = updates.get('overtime', s.get('overtime', 0) or 0)
            bn = updates.get('bonus', s.get('bonus', 0) or 0)
            dd = updates.get('deductions', s.get('deductions', 0) or 0)
            updates['final_salary'] = max(0, round(base + ot + bn - dd, 2))
            updates['updated_at'] = datetime.utcnow()
            db.salaries.update_one({'_id': ObjectId(id)}, {'$set': updates})
        
        s = db.salaries.find_one({'_id': ObjectId(id)})
        s['id'] = str(s['_id'])
        for key in ('created_at', 'updated_at'):
            if hasattr(s.get(key), 'isoformat'):
                s[key] = s[key].isoformat()
        return jsonify({'message': 'Salary updated', 'success': True, 'data': s}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500
