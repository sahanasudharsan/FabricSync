"""Daily Stock Management module - comprehensive stock tracking with raw material, production, and waste"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
from datetime import datetime, timedelta
from calendar import monthrange
from utils.auth import token_required

daily_usage_bp = Blueprint('daily_usage', __name__, url_prefix='/api/daily-usage')

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

@daily_usage_bp.route('/raw-stock', methods=['GET'])
@token_required
def get_raw_stock():
    """Get current raw stock level"""
    try:
        db = get_db()
        stock_record = db.raw_stock.find_one({'status': 'active'})
        
        if not stock_record:
            # Initialize with default stock if not exists
            default_stock = {
                'total_raw_stock': 0,
                'status': 'active',
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            result = db.raw_stock.insert_one(default_stock)
            stock_record = default_stock
            stock_record['id'] = str(result.inserted_id)
        else:
            stock_record['id'] = str(stock_record['_id'])
        
        stock_record['_id'] = str(stock_record['_id'])
        if hasattr(stock_record.get('created_at'), 'isoformat'):
            stock_record['created_at'] = stock_record['created_at'].isoformat()
        if hasattr(stock_record.get('updated_at'), 'isoformat'):
            stock_record['updated_at'] = stock_record['updated_at'].isoformat()
            
        return jsonify({'success': True, 'data': stock_record}), 200
        
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@daily_usage_bp.route('/raw-stock', methods=['POST'])
@token_required
def update_raw_stock():
    """Update overall raw stock"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'No data provided', 'success': False}), 400
        
        total_raw_stock = float(data.get('total_raw_stock', 0))
        
        if total_raw_stock < 0:
            return jsonify({'message': 'Stock cannot be negative', 'success': False}), 400
        
        db = get_db()
        
        # Find existing stock record
        existing = db.raw_stock.find_one({'status': 'active'})
        
        if existing:
            # Update existing record
            db.raw_stock.update_one(
                {'_id': existing['_id']},
                {
                    '$set': {
                        'total_raw_stock': total_raw_stock,
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            stock_id = str(existing['_id'])
        else:
            # Create new record
            stock_record = {
                'total_raw_stock': total_raw_stock,
                'status': 'active',
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            result = db.raw_stock.insert_one(stock_record)
            stock_id = str(result.inserted_id)
        
        return jsonify({
            'success': True,
            'message': 'Raw stock updated successfully',
            'data': {'total_raw_stock': total_raw_stock}
        }), 200
        
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@daily_usage_bp.route('', methods=['GET'])
@token_required
def get_daily_stock_records():
    """Get daily stock records with filters"""
    try:
        db = get_db()
        
        # Query parameters
        start_date = request.args.get('start_date', '').strip()
        end_date = request.args.get('end_date', '').strip()
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        show_warnings = request.args.get('show_warnings', '').lower() == 'true'
        
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
        
        if show_warnings:
            query['waste_quantity'] = {'$gt': 6.0}
        
        # Get total count for pagination
        total = db.daily_stock.count_documents(query)
        
        # Get paginated results
        skip = (page - 1) * limit
        records = list(db.daily_stock.find(query)
                      .sort([('date', -1)])
                      .skip(skip)
                      .limit(limit))
        
        for r in records:
            r['id'] = str(r['_id'])
            r['_id'] = str(r['_id'])
            if isinstance(r.get('date'), datetime):
                r['date'] = r['date'].date().isoformat()
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

@daily_usage_bp.route('', methods=['POST'])
@token_required
def create_daily_stock_record():
    """Create a simplified daily stock record"""
    try:
        db = get_db()
        data = request.get_json()
        
        # Parse and validate data
        record_date = _parse_date(data.get('date'))
        if not record_date:
            return jsonify({'message': 'Invalid date format', 'success': False}), 400
        
        total_raw_stock = float(data.get('total_raw_stock', 0))
        raw_stock_used = float(data.get('raw_stock_used', 0))
        fabric_produced = float(data.get('fabric_produced', 0))
        
        # Validate inputs
        if total_raw_stock < 0 or raw_stock_used < 0 or fabric_produced < 0:
            return jsonify({'message': 'Stock values cannot be negative', 'success': False}), 400
        
        # Remove strict validation - allow users to plan and enter reasonable values
        # Only warn if values seem unreasonable (optional future enhancement)
        
        # Calculate remaining raw stock
        remaining_raw_stock = total_raw_stock - raw_stock_used
        
        # Calculate expected fabric production (90% rule)
        expected_fabric = raw_stock_used * 0.9
        
        # Check production efficiency
        production_warning = fabric_produced < expected_fabric
        
        # Check for existing record
        existing = db.daily_stock.find_one({'date': record_date})
        if existing:
            return jsonify({'message': 'Stock record for this date already exists', 'success': False}), 400
        
        # Create record
        record = {
            'date': record_date,
            'total_raw_stock': total_raw_stock,
            'raw_stock_used': raw_stock_used,
            'remaining_raw_stock': remaining_raw_stock,
            'fabric_produced': fabric_produced,
            'expected_fabric': expected_fabric,
            'production_warning': production_warning,
            'created_at': datetime.now(),
            'updated_at': datetime.now()
        }
        
        result = db.daily_stock.insert_one(record)
        record['id'] = str(result.inserted_id)
        
        return jsonify({'success': True, 'data': record}), 201
        
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@daily_usage_bp.route('/<id>', methods=['PUT'])
@token_required
def update_daily_stock_record(id):
    """Update daily stock record"""
    try:
        if not ObjectId.is_valid(id):
            return jsonify({'message': 'Invalid ID', 'success': False}), 400
            
        data = request.get_json()
        db = get_db()
        
        existing = db.daily_stock.find_one({'_id': ObjectId(id)})
        if not existing:
            return jsonify({'message': 'Stock record not found', 'success': False}), 404
        
        updates = {}
        
        if 'total_raw_stock' in data:
            total_raw_stock = float(data['total_raw_stock'])
            if total_raw_stock < 0:
                return jsonify({'message': 'Total raw stock cannot be negative', 'success': False}), 400
            updates['total_raw_stock'] = total_raw_stock
            
        if 'raw_stock_used' in data:
            raw_stock_used = float(data['raw_stock_used'])
            if raw_stock_used < 0:
                return jsonify({'message': 'Raw stock used cannot be negative', 'success': False}), 400
            updates['raw_stock_used'] = raw_stock_used
            
        if 'fabric_produced' in data:
            fabric_produced = float(data['fabric_produced'])
            if fabric_produced < 0:
                return jsonify({'message': 'Fabric produced cannot be negative', 'success': False}), 400
            updates['fabric_produced'] = fabric_produced
        
        if updates:
            # Recalculate remaining raw stock if relevant fields changed
            if 'total_raw_stock' in updates or 'raw_stock_used' in updates:
                total = updates.get('total_raw_stock', existing['total_raw_stock'])
                used = updates.get('raw_stock_used', existing['raw_stock_used'])
                remaining = total - used
                
                # Remove strict validation - allow users to plan and enter reasonable values
                updates['remaining_raw_stock'] = remaining
            
            # Recalculate expected fabric and production warning if relevant fields changed
            if 'raw_stock_used' in updates or 'fabric_produced' in updates:
                used = updates.get('raw_stock_used', existing['raw_stock_used'])
                fabric = updates.get('fabric_produced', existing['fabric_produced'])
                expected_fabric = used * 0.9
                production_warning = fabric < expected_fabric
                
                updates['expected_fabric'] = expected_fabric
                updates['production_warning'] = production_warning
            
            updates['updated_at'] = datetime.utcnow()
            db.daily_stock.update_one({'_id': ObjectId(id)}, {'$set': updates})
        
        # Get updated record
        updated = db.daily_stock.find_one({'_id': ObjectId(id)})
        updated['id'] = str(updated['_id'])
        updated['_id'] = str(updated['_id'])
        updated['date'] = updated['date'].date().isoformat()
        if hasattr(updated.get('created_at'), 'isoformat'):
            updated['created_at'] = updated['created_at'].isoformat()
        if hasattr(updated.get('updated_at'), 'isoformat'):
            updated['updated_at'] = updated['updated_at'].isoformat()
        
        return jsonify({'success': True, 'data': updated}), 200
        
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@daily_usage_bp.route('/<id>', methods=['DELETE'])
@token_required
def delete_daily_stock_record(id):
    """Delete daily stock record"""
    try:
        if not ObjectId.is_valid(id):
            return jsonify({'message': 'Invalid ID', 'success': False}), 400
        db = get_db()
        result = db.daily_stock.delete_one({'_id': ObjectId(id)})
        if result.deleted_count == 0:
            return jsonify({'message': 'Stock record not found', 'success': False}), 404
        return jsonify({'success': True, 'message': 'Stock record deleted'}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@daily_usage_bp.route('/reduction-history', methods=['GET'])
@token_required
def get_reduction_history():
    """Get comprehensive reduction history with summaries"""
    try:
        db = get_db()
        
        # Query parameters
        start_date = request.args.get('start_date', '').strip()
        end_date = request.args.get('end_date', '').strip()
        summary_type = request.args.get('summary', '').strip().lower()  # weekly, monthly
        
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
        
        records = list(db.daily_stock.find(query).sort([('date', -1)]))
        
        # Process records
        history_data = []
        for r in records:
            history_data.append({
                'id': str(r['_id']),
                'date': r['date'].date().isoformat() if isinstance(r['date'], datetime) else r['date'],
                'total_raw_stock': r['total_raw_stock'],
                'raw_stock_used': r['raw_stock_used'],
                'remaining_raw_stock': r['remaining_raw_stock'],
                'fabric_produced': r['fabric_produced'],
                'created_at': r['created_at'].isoformat() if hasattr(r['created_at'], 'isoformat') else str(r['created_at'])
            })
        
        # Generate summaries if requested
        summaries = {}
        if summary_type in ('weekly', 'monthly'):
            if summary_type == 'weekly':
                # Group by week
                for record in history_data:
                    date_obj = datetime.fromisoformat(record['date'])
                    week_start = date_obj - timedelta(days=date_obj.weekday())
                    week_key = week_start.date().isoformat()
                    
                    if week_key not in summaries:
                        summaries[week_key] = {
                            'period_start': week_key,
                            'period_end': (week_start + timedelta(days=6)).date().isoformat(),
                            'total_raw_stock': 0,
                            'total_raw_stock_used': 0,
                            'total_fabric_produced': 0,
                            'total_remaining_raw_stock': 0,
                            'record_count': 0
                        }
                    
                    summary = summaries[week_key]
                    summary['total_raw_stock_used'] += record['raw_stock_used']
                    summary['total_fabric_produced'] += record['fabric_produced']
                    summary['total_remaining_raw_stock'] += record['remaining_raw_stock']
                    summary['record_count'] += 1
                    if summary['record_count'] == 1:  # First day of week
                        summary['total_raw_stock'] = record['total_raw_stock']
            
            elif summary_type == 'monthly':
                # Group by month
                for record in history_data:
                    date_obj = datetime.fromisoformat(record['date'])
                    month_key = f"{date_obj.year}-{date_obj.month:02d}"
                    
                    if month_key not in summaries:
                        summaries[month_key] = {
                            'period_start': f"{date_obj.year}-{date_obj.month:02d}-01",
                            'period_end': f"{date_obj.year}-{date_obj.month:02d}-{monthrange(date_obj.year, date_obj.month)[1]}",
                            'total_raw_stock': 0,
                            'total_raw_stock_used': 0,
                            'total_fabric_produced': 0,
                            'total_remaining_raw_stock': 0,
                            'record_count': 0
                        }
                    
                    summary = summaries[month_key]
                    summary['total_raw_stock_used'] += record['raw_stock_used']
                    summary['total_fabric_produced'] += record['fabric_produced']
                    summary['total_remaining_raw_stock'] += record['remaining_raw_stock']
                    summary['record_count'] += 1
                    if summary['record_count'] == 1:  # First day of month
                        summary['total_raw_stock'] = record['total_raw_stock']
        
        return jsonify({
            'success': True,
            'data': {
                'history': history_data,
                'summaries': list(summaries.values()) if summaries else [],
                'summary_type': summary_type
            }
        }), 200
        
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@daily_usage_bp.route('/warnings', methods=['GET'])
@token_required
def get_warnings():
    """Get current warnings and statistics"""
    try:
        db = get_db()
        
        # Get today's stock record
        today = datetime.now().date()
        today_stock = db.daily_stock.find_one({'date': datetime(today.year, today.month, today.day)})
        
        # Get current raw stock
        raw_stock_record = db.raw_stock.find_one({'status': 'active'})
        current_raw_stock = raw_stock_record['total_raw_stock'] if raw_stock_record else 0
        
        # Get recent warnings (last 7 days)
        week_ago = datetime.now() - timedelta(days=7)
        recent_warnings = list(db.daily_stock.find({
            'date': {'$gte': week_ago},
            'warning_triggered': True
        }).sort([('date', -1)]))
        
        # Get warning statistics for current month
        current_month_start = datetime(datetime.now().year, datetime.now().month, 1)
        monthly_warnings = db.daily_stock.count_documents({
            'date': {'$gte': current_month_start},
            'warning_triggered': True
        })
        
        monthly_days = db.daily_stock.count_documents({'date': {'$gte': current_month_start}})
        
        # Get current month totals
        current_month_records = list(db.daily_stock.find({
            'date': {'$gte': current_month_start}
        }))
        
        month_totals = {
            'total_raw_material_used': sum(r['raw_material_used'] for r in current_month_records),
            'total_manufactured_product': sum(r['manufactured_product'] for r in current_month_records),
            'total_waste_quantity': sum(r['waste_quantity'] for r in current_month_records)
        }
        
        warning_data = {
            'current_raw_stock': current_raw_stock,
            'today_stock': None,
            'recent_warnings': [],
            'monthly_stats': {
                'total_warnings': monthly_warnings,
                'total_days': monthly_days,
                'warning_percentage': round((monthly_warnings / monthly_days) * 100, 2) if monthly_days > 0 else 0,
                'month_totals': month_totals
            }
        }
        
        if today_stock:
            warning_data['today_stock'] = {
                'date': today_stock['date'].date().isoformat(),
                'opening_stock': today_stock['opening_stock'],
                'raw_material_used': today_stock['raw_material_used'],
                'manufactured_product': today_stock['manufactured_product'],
                'waste_quantity': today_stock['waste_quantity'],
                'closing_stock': today_stock['closing_stock'],
                'warning_triggered': today_stock['warning_triggered']
            }
        
        for warning in recent_warnings:
            warning_data['recent_warnings'].append({
                'date': warning['date'].date().isoformat(),
                'waste_quantity': warning['waste_quantity'],
                'closing_stock': warning['closing_stock']
            })
        
        return jsonify({'success': True, 'data': warning_data}), 200
        
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500
