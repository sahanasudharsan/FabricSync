"""Waste management - auto daily totals, high waste highlight, trend"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
from datetime import datetime, date, timedelta
from utils.auth import token_required

waste_bp = Blueprint('waste', __name__, url_prefix='/api/waste')

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

@waste_bp.route('', methods=['GET'])
@token_required
def get_waste():
    """Get waste records with filters, daily totals, trend"""
    try:
        db = get_db()
        date_str = request.args.get('date', '').strip()
        fabric_type = request.args.get('fabric_type', '').strip()
        days = int(request.args.get('days', 30) or 30)
        
        query = {}
        if date_str:
            d = _parse_date(date_str)
            if d:
                query['date'] = d
        if fabric_type:
            query['fabric_type'] = {'$regex': fabric_type, '$options': 'i'}
        
        if not query:
            end_dt = datetime.now()
            start_dt = end_dt - timedelta(days=days)
            query['date'] = {'$gte': start_dt, '$lte': end_dt}
        
        records = list(db.waste.find(query).sort([('date', -1), ('created_at', -1)]))
        
        daily_totals = {}
        for r in records:
            r['id'] = str(r['_id'])
            r['_id'] = str(r['_id'])
            dkey = r['date'].isoformat() if hasattr(r.get('date'), 'isoformat') else str(r.get('date'))
            daily_totals[dkey] = daily_totals.get(dkey, 0) + float(r.get('quantity', 0))
            r['date_str'] = dkey
        
        for r in records:
            dkey = r.get('date_str', '')
            r['daily_total'] = daily_totals.get(dkey, 0)
        
        return jsonify({
            'success': True,
            'data': records,
            'daily_totals': daily_totals
        }), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@waste_bp.route('/trend', methods=['GET'])
@token_required
def get_waste_trend():
    """Waste trend chart data - daily totals over last N days"""
    try:
        db = get_db()
        days = int(request.args.get('days', 30) or 30)
        end_dt = datetime.now()
        start_dt = end_dt - timedelta(days=days)
        
        pipeline = [
            {'$match': {'date': {'$gte': start_dt, '$lte': end_dt}}},
            {'$group': {'_id': '$date', 'total': {'$sum': '$quantity'}}},
            {'$sort': {'_id': 1}}
        ]
        results = list(db.waste.aggregate(pipeline))
        trend = [{'date': r['_id'].isoformat(), 'total': r['total']} for r in results]
        return jsonify({'success': True, 'data': trend}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@waste_bp.route('', methods=['POST'])
@waste_bp.route('/add', methods=['POST'])
@token_required
def create_waste():
    """Record waste and return threshold warnings"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'No data provided', 'success': False}), 400
        
        fabric_type = (data.get('fabric_type') or '').strip()
        process_stage = (data.get('process_stage') or '').strip()
        quantity = float(data.get('quantity', 0) or 0)
        d = _parse_date(data.get('date'))
        reason = (data.get('reason') or '').strip()
        
        if not fabric_type:
            return jsonify({'message': 'Fabric type is required', 'success': False}), 400
        if quantity < 0:
            return jsonify({'message': 'Quantity cannot be negative', 'success': False}), 400
        if not d:
            d = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        doc = {
            'fabric_type': fabric_type,
            'process_stage': process_stage,
            'quantity': quantity,
            'date': d,
            'reason': reason,
            'created_at': datetime.utcnow()
        }
        db = get_db()
        result = db.waste.insert_one(doc)

        # Recalculate total waste for the given day to drive UI warnings
        day_start = d.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = d.replace(hour=23, minute=59, second=59, microsecond=999999)
        daily_total = sum(
            r.get('quantity', 0) or 0
            for r in db.waste.find({'date': {'$gte': day_start, '$lte': day_end}})
        )

        warning = daily_total > 6
        notify_collector = daily_total >= 150

        doc['id'] = str(result.inserted_id)
        doc['_id'] = str(result.inserted_id)
        doc['date'] = d.date().isoformat() if isinstance(d, datetime) else d.isoformat()
        doc['created_at'] = doc['created_at'].isoformat()
        return jsonify({
            'message': 'Waste recorded',
            'success': True,
            'data': doc,
            'daily_total': float(daily_total),
            'warning': warning,
            'notify_collector': notify_collector
        }), 201
    except ValueError:
        return jsonify({'message': 'Invalid quantity', 'success': False}), 400
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@waste_bp.route('/<id>', methods=['DELETE'])
@token_required
def delete_waste(id):
    """Delete waste record"""
    try:
        if not ObjectId.is_valid(id):
            return jsonify({'message': 'Invalid ID', 'success': False}), 400
        db = get_db()
        result = db.waste.delete_one({'_id': ObjectId(id)})
        if result.deleted_count == 0:
            return jsonify({'message': 'Waste record not found', 'success': False}), 404
        return jsonify({'message': 'Waste record deleted', 'success': True}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500
