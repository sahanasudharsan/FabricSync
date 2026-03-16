"""Fabric stock management routes"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
from datetime import datetime
from utils.auth import token_required

fabric_bp = Blueprint('fabrics', __name__, url_prefix='/api/fabrics')

def get_db():
    from utils.db import get_db
    return get_db()

def _serialize(f):
    f['id'] = str(f['_id'])
    f['_id'] = str(f['_id'])
    return f

@fabric_bp.route('', methods=['GET'])
@token_required
def get_fabrics():
    """Get all fabrics - low stock highlighted"""
    try:
        db = get_db()
        search = (request.args.get('search') or '').strip()
        query = {}
        if search:
            query['$or'] = [
                {'fabric_name': {'$regex': search, '$options': 'i'}},
                {'type': {'$regex': search, '$options': 'i'}}
            ]
        fabrics = list(db.fabrics.find(query).sort('fabric_name', 1))
        for f in fabrics:
            _serialize(f)
            f['is_low_stock'] = f.get('threshold_limit', 0) > 0 and f.get('quantity', 0) <= f.get('threshold_limit', 0)
        return jsonify({'success': True, 'data': fabrics}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@fabric_bp.route('/<id>', methods=['GET'])
@token_required
def get_fabric(id):
    """Get single fabric"""
    try:
        if not ObjectId.is_valid(id):
            return jsonify({'message': 'Invalid ID', 'success': False}), 400
        db = get_db()
        f = db.fabrics.find_one({'_id': ObjectId(id)})
        if not f:
            return jsonify({'message': 'Fabric not found', 'success': False}), 404
        _serialize(f)
        f['is_low_stock'] = f.get('threshold_limit', 0) > 0 and f.get('quantity', 0) <= f.get('threshold_limit', 0)
        return jsonify({'success': True, 'data': f}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@fabric_bp.route('', methods=['POST'])
@token_required
def create_fabric():
    """Add fabric"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'No data provided', 'success': False}), 400
        
        fabric_name = (data.get('fabric_name') or '').strip()
        fabric_type = (data.get('type') or '').strip()
        quantity = float(data.get('quantity', 0) or 0)
        threshold_limit = float(data.get('threshold_limit', 0) or 0)
        
        if not fabric_name:
            return jsonify({'message': 'Fabric name is required', 'success': False}), 400
        if quantity < 0:
            return jsonify({'message': 'Quantity cannot be negative', 'success': False}), 400
        
        doc = {
            'fabric_name': fabric_name,
            'type': fabric_type,
            'quantity': quantity,
            'threshold_limit': threshold_limit,
            'last_updated': datetime.utcnow(),
            'created_at': datetime.utcnow()
        }
        db = get_db()
        result = db.fabrics.insert_one(doc)
        _serialize(doc)
        return jsonify({'message': 'Fabric added', 'success': True, 'data': doc}), 201
    except ValueError:
        return jsonify({'message': 'Invalid quantity or threshold', 'success': False}), 400
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@fabric_bp.route('/<id>', methods=['PUT'])
@token_required
def update_fabric(id):
    """Update fabric (quantity, threshold, etc.)"""
    try:
        if not ObjectId.is_valid(id):
            return jsonify({'message': 'Invalid ID', 'success': False}), 400
        data = request.get_json()
        db = get_db()
        f = db.fabrics.find_one({'_id': ObjectId(id)})
        if not f:
            return jsonify({'message': 'Fabric not found', 'success': False}), 404
        
        updates = {'last_updated': datetime.utcnow()}
        if 'fabric_name' in data and data['fabric_name']:
            updates['fabric_name'] = str(data['fabric_name']).strip()
        if 'type' in data:
            updates['type'] = str(data.get('type') or '').strip()
        if 'quantity' in data:
            q = float(data.get('quantity', 0) or 0)
            if q < 0:
                return jsonify({'message': 'Quantity cannot be negative', 'success': False}), 400
            updates['quantity'] = q
        if 'threshold_limit' in data:
            updates['threshold_limit'] = float(data.get('threshold_limit', 0) or 0)
        
        db.fabrics.update_one({'_id': ObjectId(id)}, {'$set': updates})
        f = db.fabrics.find_one({'_id': ObjectId(id)})
        _serialize(f)
        return jsonify({'message': 'Fabric updated', 'success': True, 'data': f}), 200
    except ValueError:
        return jsonify({'message': 'Invalid value', 'success': False}), 400
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@fabric_bp.route('/<id>', methods=['DELETE'])
@token_required
def delete_fabric(id):
    """Delete fabric"""
    try:
        if not ObjectId.is_valid(id):
            return jsonify({'message': 'Invalid ID', 'success': False}), 400
        db = get_db()
        result = db.fabrics.delete_one({'_id': ObjectId(id)})
        if result.deleted_count == 0:
            return jsonify({'message': 'Fabric not found', 'success': False}), 404
        return jsonify({'message': 'Fabric deleted', 'success': True}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500
