"""Report generation - PDF export, CSV download, charts"""
import io
import csv
from flask import Blueprint, request, jsonify, send_file
from bson import ObjectId
from datetime import datetime, date, timedelta
from utils.auth import token_required

report_bp = Blueprint('reports', __name__, url_prefix='/api/reports')

def get_db():
    from utils.db import get_db
    return get_db()

def _parse_month(month_str):
    if not month_str:
        now = date.today()
        return now.year, now.month
    try:
        parts = month_str.split('-')
        return int(parts[0]), int(parts[1])
    except (ValueError, IndexError):
        return None, None

@report_bp.route('/salary', methods=['GET'])
@token_required
def salary_report():
    """Monthly salary report - summary + data"""
    try:
        month_str = request.args.get('month', '')
        export = request.args.get('export', '')  # csv or pdf
        year, month = _parse_month(month_str)
        if not year or not month:
            return jsonify({'message': 'Invalid month (use YYYY-MM)', 'success': False}), 400
        
        db = get_db()
        records = list(db.salaries.find({'year': year, 'month': month}))
        workers = {str(w['_id']): w for w in db.workers.find({})}
        
        total_expense = 0
        for r in records:
            r['worker_name'] = workers.get(r.get('worker_id'), {}).get('name', '-')
            total_expense += float(r.get('final_salary', 0) or 0)
        
        summary = {
            'month': f'{year}-{month:02d}',
            'total_workers': len(records),
            'total_expense': round(total_expense, 2)
        }
        
        if export == 'csv':
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(['Worker', 'Present Days', 'Work Done', 'Base Salary', 'Overtime', 'Bonus', 'Deductions', 'Final Salary'])
            for r in records:
                writer.writerow([
                    r.get('worker_name', '-'),
                    r.get('total_present_days', 0),
                    r.get('total_work_done', 0),
                    r.get('calculated_salary', 0),
                    r.get('overtime', 0),
                    r.get('bonus', 0),
                    r.get('deductions', 0),
                    r.get('final_salary', 0)
                ])
            output.seek(0)
            return send_file(
                io.BytesIO(output.getvalue().encode('utf-8')),
                mimetype='text/csv',
                as_attachment=True,
                download_name=f'salary_report_{year}_{month:02d}.csv'
            )
        
        return jsonify({'success': True, 'data': records, 'summary': summary}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@report_bp.route('/attendance', methods=['GET'])
@token_required
def attendance_report():
    """Attendance report for a month"""
    try:
        month_str = request.args.get('month', '')
        export = request.args.get('export', '')
        year, month = _parse_month(month_str)
        if not year or not month:
            return jsonify({'message': 'Invalid month', 'success': False}), 400
        
        from calendar import monthrange
        start = datetime(year, month, 1)
        end = datetime(year, month, monthrange(year, month)[1], 23, 59, 59)
        
        db = get_db()
        pipeline = [
            {'$match': {'date': {'$gte': start, '$lte': end}, 'status': 'present'}},
            {'$group': {'_id': '$worker_id', 'present_days': {'$sum': 1}}}
        ]
        agg = list(db.attendance.aggregate(pipeline))
        workers = {str(w['_id']): w for w in db.workers.find({})}
        
        data = []
        for a in agg:
            w = workers.get(a['_id'], {})
            data.append({
                'worker_id': a['_id'],
                'worker_name': w.get('name', '-'),
                'present_days': a['present_days']
            })
        
        if export == 'csv':
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(['Worker', 'Present Days'])
            for r in data:
                writer.writerow([r['worker_name'], r['present_days']])
            output.seek(0)
            return send_file(
                io.BytesIO(output.getvalue().encode('utf-8')),
                mimetype='text/csv',
                as_attachment=True,
                download_name=f'attendance_report_{year}_{month:02d}.csv'
            )
        
        return jsonify({'success': True, 'data': data, 'summary': {'month': f'{year}-{month:02d}'}}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@report_bp.route('/fabric', methods=['GET'])
@token_required
def fabric_report():
    """Enhanced fabric stock report with raw stock integration"""
    try:
        db = get_db()
        
        # Get fabric stock data
        fabrics = list(db.fabrics.find({}).sort('fabric_name', 1))
        low_stock = [f for f in fabrics if f.get('threshold_limit', 0) > 0 and f.get('quantity', 0) <= f.get('threshold_limit', 0)]
        
        for f in fabrics:
            f['id'] = str(f['_id'])
            f['is_low_stock'] = f.get('threshold_limit', 0) > 0 and f.get('quantity', 0) <= f.get('threshold_limit', 0)
        
        # Get raw stock data
        raw_stock_record = db.raw_stock.find_one({'status': 'active'})
        current_raw_stock = raw_stock_record['total_raw_stock'] if raw_stock_record else 0
        
        # Get daily stock data for stock movement
        month_str = request.args.get('month', '')
        if month_str:
            year, month = _parse_month(month_str)
            if year and month:
                from calendar import monthrange
                start = datetime(year, month, 1)
                end = datetime(year, month, monthrange(year, month)[1], 23, 59, 59)
                daily_stocks = list(db.daily_stock.find({'date': {'$gte': start, '$lte': end}}).sort('date', 1))
            else:
                daily_stocks = []
        else:
            # Get last 30 days
            end_dt = datetime.now()
            start_dt = end_dt - timedelta(days=30)
            daily_stocks = list(db.daily_stock.find({'date': {'$gte': start_dt, '$lte': end_dt}}).sort('date', 1))
        
        # Calculate stock movement
        total_opening_stock = sum(ds.get('opening_stock', 0) for ds in daily_stocks)
        total_raw_used = sum(ds.get('raw_material_used', 0) for ds in daily_stocks)
        total_manufactured = sum(ds.get('manufactured_product', 0) for ds in daily_stocks)
        total_waste = sum(ds.get('waste_quantity', 0) for ds in daily_stocks)
        
        # Get current month data
        cur_year, cur_month = datetime.now().year, datetime.now().month
        current_month_start = datetime(cur_year, cur_month, 1)
        current_month_stocks = list(db.daily_stock.find({'date': {'$gte': current_month_start}}))
        
        month_opening = current_month_stocks[0].get('opening_stock', 0) if current_month_stocks else 0
        month_used = sum(ds.get('raw_material_used', 0) for ds in current_month_stocks)
        month_manufactured = sum(ds.get('manufactured_product', 0) for ds in current_month_stocks)
        month_waste = sum(ds.get('waste_quantity', 0) for ds in current_month_stocks)
        
        enhanced_summary = {
            'total_items': len(fabrics),
            'low_stock_count': len(low_stock),
            'current_raw_stock': current_raw_stock,
            'total_fabric_stock': sum(f.get('quantity', 0) for f in fabrics),
            'stock_movement': {
                'total_opening_stock': total_opening_stock,
                'total_raw_used': total_raw_used,
                'total_manufactured': total_manufactured,
                'total_waste': total_waste
            },
            'current_month': {
                'opening_stock': month_opening,
                'raw_used': month_used,
                'manufactured': month_manufactured,
                'waste': month_waste
            }
        }
        
        export = request.args.get('export', '')
        if export == 'csv':
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(['Fabric Name', 'Type', 'Current Quantity', 'Threshold', 'Low Stock Status', 'Last Updated'])
            for f in fabrics:
                writer.writerow([
                    f.get('fabric_name', ''),
                    f.get('type', ''),
                    f.get('quantity', 0),
                    f.get('threshold_limit', 0),
                    'Yes' if f.get('is_low_stock') else 'No',
                    f.get('updated_at', '').split('T')[0] if f.get('updated_at') else 'N/A'
                ])
            
            # Add stock movement summary
            writer.writerow([])
            writer.writerow(['Stock Movement Summary'])
            writer.writerow(['Current Raw Stock', current_raw_stock])
            writer.writerow(['Total Opening Stock', total_opening_stock])
            writer.writerow(['Total Raw Material Used', total_raw_used])
            writer.writerow(['Total Manufactured Product', total_manufactured])
            writer.writerow(['Total Waste', total_waste])
            
            output.seek(0)
            return send_file(
                io.BytesIO(output.getvalue().encode('utf-8')),
                mimetype='text/csv',
                as_attachment=True,
                download_name='enhanced_fabric_stock_report.csv'
            )
        
        return jsonify({'success': True, 'data': fabrics, 'summary': enhanced_summary}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@report_bp.route('/waste', methods=['GET'])
@token_required
def waste_report():
    """Enhanced waste report with daily stock management integration"""
    try:
        month_str = request.args.get('month', '')
        days = int(request.args.get('days', 30) or 30)
        export = request.args.get('export', '')
        
        db = get_db()
        
        # Determine date range
        year, month = _parse_month(month_str) if month_str else (None, None)
        if year and month:
            from calendar import monthrange
            start = datetime(year, month, 1)
            end = datetime(year, month, monthrange(year, month)[1], 23, 59, 59)
        else:
            end_dt = datetime.now()
            start_dt = end_dt - timedelta(days=days)
            start, end = start_dt, end_dt
        
        # Get daily stock data (new comprehensive system)
        daily_stocks = list(db.daily_stock.find({'date': {'$gte': start, '$lte': end}}).sort('date', 1))
        
        # Get legacy waste data for backward compatibility
        legacy_waste = list(db.waste.find({'date': {'$gte': start, '$lte': end}}))
        
        # Process daily stock data
        stock_waste_data = []
        total_waste = 0
        warning_days = 0
        total_manufactured = 0
        total_raw_used = 0
        
        for ds in daily_stocks:
            waste_qty = ds.get('waste_quantity', 0)
            # Include all daily stock records, even those with 0 waste, for complete picture
            stock_waste_data.append({
                'id': str(ds['_id']),
                'date': ds['date'].date().isoformat() if isinstance(ds['date'], datetime) else str(ds['date']),
                'waste_quantity': waste_qty,
                'opening_stock': ds.get('opening_stock', 0),
                'raw_material_used': ds.get('raw_material_used', 0),
                'manufactured_product': ds.get('manufactured_product', 0),
                'closing_stock': ds.get('closing_stock', 0),
                'warning_triggered': ds.get('warning_triggered', False),
                'notes': ds.get('notes', ''),
                'source': 'daily_stock'
            })
            
            if waste_qty > 0:
                total_waste += waste_qty
            if ds.get('warning_triggered', False):
                warning_days += 1
            total_manufactured += ds.get('manufactured_product', 0)
            total_raw_used += ds.get('raw_material_used', 0)
        
        # Process legacy waste data
        legacy_waste_data = []
        for lw in legacy_waste:
            waste_qty = lw.get('quantity', 0)
            if waste_qty > 0:
                legacy_waste_data.append({
                    'id': str(lw['_id']),
                    'date': lw['date'].date().isoformat() if isinstance(lw['date'], datetime) else str(lw['date']),
                    'waste_quantity': waste_qty,
                    'fabric_type': lw.get('fabric_type', ''),
                    'process_stage': lw.get('process_stage', ''),
                    'reason': lw.get('reason', ''),
                    'source': 'legacy'
                })
                total_waste += waste_qty
        
        # Combine data
        combined_data = stock_waste_data + legacy_waste_data
        combined_data.sort(key=lambda x: x['date'])
        
        # Calculate waste percentage
        waste_percentage = (total_waste / total_raw_used * 100) if total_raw_used > 0 else 0
        
        # Get warning statistics
        current_month_start = datetime(datetime.now().year, datetime.now().month, 1)
        monthly_warnings = db.daily_stock.count_documents({
            'date': {'$gte': current_month_start},
            'warning_triggered': True
        })
        
        monthly_days = db.daily_stock.count_documents({'date': {'$gte': current_month_start}})
        
        # Ensure we have some data to display even if no waste records
        if not combined_data:
            # Create sample data structure to show the report format
            combined_data = [{
                'date': start.date().isoformat(),
                'waste_quantity': 0,
                'opening_stock': 0,
                'raw_material_used': 0,
                'manufactured_product': 0,
                'closing_stock': 0,
                'warning_triggered': False,
                'notes': 'No data available for selected period',
                'source': 'sample'
            }]
        
        enhanced_summary = {
            'total_waste': round(total_waste, 2),
            'total_manufactured': round(total_manufactured, 2),
            'total_raw_used': round(total_raw_used, 2),
            'waste_percentage': round(waste_percentage, 2),
            'warning_days': warning_days,
            'record_count': len(combined_data),
            'monthly_warnings': monthly_warnings,
            'monthly_days': monthly_days,
            'monthly_warning_percentage': round((monthly_warnings / monthly_days) * 100, 2) if monthly_days > 0 else 0,
            'data_sources': {
                'daily_stock': len(stock_waste_data),
                'legacy': len(legacy_waste_data)
            },
            'period': {
                'start': start.date().isoformat(),
                'end': end.date().isoformat(),
                'days': (end - start).days
            }
        }
        
        if export == 'csv':
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Enhanced CSV with comprehensive data
            writer.writerow(['Date', 'Waste Quantity (kg)', 'Opening Stock', 'Raw Material Used', 'Manufactured Product', 'Closing Stock', 'Warning Status', 'Notes', 'Data Source'])
            
            for record in combined_data:
                writer.writerow([
                    record.get('date', ''),
                    record.get('waste_quantity', 0),
                    record.get('opening_stock', '-'),
                    record.get('raw_material_used', '-'),
                    record.get('manufactured_product', '-'),
                    record.get('closing_stock', '-'),
                    'Yes' if record.get('warning_triggered') else 'No',
                    record.get('notes', '-'),
                    record.get('source', '-')
                ])
            
            # Add summary section
            writer.writerow([])
            writer.writerow(['Waste Report Summary'])
            writer.writerow(['Total Waste (kg)', total_waste])
            writer.writerow(['Total Manufactured Product (kg)', total_manufactured])
            writer.writerow(['Total Raw Material Used (kg)', total_raw_used])
            writer.writerow(['Waste Percentage (%)', waste_percentage])
            writer.writerow(['Warning Days', warning_days])
            writer.writerow(['Monthly Warnings', monthly_warnings])
            writer.writerow(['Monthly Warning Percentage (%)', enhanced_summary['monthly_warning_percentage']])
            
            output.seek(0)
            return send_file(
                io.BytesIO(output.getvalue().encode('utf-8')),
                mimetype='text/csv',
                as_attachment=True,
                download_name='enhanced_waste_report.csv'
            )
        
        return jsonify({'success': True, 'data': combined_data, 'summary': enhanced_summary}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@report_bp.route('/generate', methods=['GET'])
@token_required
def reports_generate():
    """Combined reports endpoint - type=attendance|salary|waste|allocation. Returns report data."""
    report_type = request.args.get('type', 'attendance').lower()
    if report_type == 'attendance':
        return attendance_report()
    if report_type == 'salary':
        return salary_report()
    if report_type == 'waste':
        return waste_report()
    if report_type == 'allocation':
        return allocation_report()
    return jsonify({'message': 'Invalid type (attendance|salary|waste|allocation)', 'success': False}), 400

def _parse_report_date(s):
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(str(s).replace('Z', '+00:00'))
        return datetime(dt.year, dt.month, dt.day)
    except (ValueError, TypeError):
        return None

@report_bp.route('/allocation', methods=['GET'])
@token_required
def allocation_report():
    """Daily work allocation report - workers, shifts, work types"""
    try:
        date_str = request.args.get('date', '').strip()
        month_str = request.args.get('month', '').strip()
        export = request.args.get('export', '')
        db = get_db()

        if date_str:
            d = _parse_report_date(date_str)
            if not d:
                return jsonify({'message': 'Invalid date', 'success': False}), 400
            assignments = list(db.assignments.find({'date': d}).sort('shift', 1))
        else:
            year, month = _parse_month(month_str)
            if not year or not month:
                return jsonify({'message': 'Date or month required', 'success': False}), 400
            from calendar import monthrange
            start = datetime(year, month, 1)
            end = datetime(year, month, monthrange(year, month)[1], 23, 59, 59)
            assignments = list(db.assignments.find({'date': {'$gte': start, '$lte': end}}).sort([('date', -1), ('shift', 1)]))

        workers = {str(w['_id']): w for w in db.workers.find({})}
        work_types = {str(wt['_id']): wt for wt in db.work_types.find({})}

        data = []
        for a in assignments:
            w = workers.get(a.get('worker_id'), {})
            wt = work_types.get(a.get('work_type_id'), {})
            wage_val = float(wt.get('wage_per_day', 0) or 0)
            dw = db.daily_wages.find_one({'worker_id': a.get('worker_id'), 'date': a.get('date')})
            if dw:
                wage_val = float(dw.get('wage', 0) or 0)
            date_val = a.get('date')
            if hasattr(date_val, 'date'):
                date_val = date_val.date().isoformat()
            elif hasattr(date_val, 'isoformat'):
                date_val = str(date_val)[:10]
            else:
                date_val = str(date_val or '')[:10]
            row = {
                'worker_id': a.get('worker_id'),
                'worker_name': w.get('name', '-'),
                'date': date_val,
                'work_type': wt.get('work_name', '-'),
                'shift': a.get('shift', '-'),
                'wage': wage_val
            }
            data.append(row)

        if export == 'csv':
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(['Worker', 'Date', 'Work Type', 'Shift', 'Wage'])
            for r in data:
                writer.writerow([r['worker_name'], r['date'], r['work_type'], r['shift'], r['wage']])
            output.seek(0)
            return send_file(
                io.BytesIO(output.getvalue().encode('utf-8')),
                mimetype='text/csv',
                as_attachment=True,
                download_name='work_allocation_report.csv'
            )
        return jsonify({'success': True, 'data': data}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@report_bp.route('/dashboard', methods=['GET'])
@token_required
def dashboard_stats():
    """Enhanced dashboard summary stats with stock management integration"""
    try:
        db = get_db()
        today_dt = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = datetime.now().replace(hour=23, minute=59, second=59, microsecond=999999)
        cur_year, cur_month = today_dt.year, today_dt.month
        
        total_workers = db.workers.count_documents({'status': 'active'})
        
        # Get current raw stock
        raw_stock_record = db.raw_stock.find_one({'status': 'active'})
        current_raw_stock = raw_stock_record['total_raw_stock'] if raw_stock_record else 0
        
        # Get fabric stock (legacy)
        total_fabric_stock = sum(f.get('quantity', 0) or 0 for f in db.fabrics.find({}))
        
        # Get today's attendance - use individual day query for accuracy
        today_dt = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_attendance = db.attendance.count_documents({'date': today_dt, 'status': 'present'})
        
        # Get today's waste from daily stock system
        today_stock = db.daily_stock.find_one({'date': today_dt})
        today_waste = today_stock.get('waste_quantity', 0) if today_stock else 0
        
        # Get monthly salary expense
        monthly_expense = sum(
            s.get('final_salary', 0) or 0 
            for s in db.salaries.find({'year': cur_year, 'month': cur_month})
        )
        
        # Get today's production metrics
        today_raw_used = today_stock.get('raw_material_used', 0) if today_stock else 0
        today_manufactured = today_stock.get('manufactured_product', 0) if today_stock else 0
        
        return jsonify({
            'success': True,
            'data': {
                'total_workers': total_workers,
                'total_stock': round(total_fabric_stock, 2),
                'current_raw_stock': round(current_raw_stock, 2),
                'today_attendance': today_attendance,
                'today_waste': round(today_waste, 2),
                'today_raw_used': round(today_raw_used, 2),
                'today_manufactured': round(today_manufactured, 2),
                'monthly_salary_expense': round(monthly_expense, 2)
            }
        }), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500
