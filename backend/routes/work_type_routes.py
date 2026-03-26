"""Work Types routes - different wages per work type"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
from datetime import datetime
from utils.auth import token_required

work_type_bp = Blueprint('work_types', __name__, url_prefix='/api/work-types')

def get_db():
    from utils.db import get_db
    return get_db()

@work_type_bp.route('', methods=['GET'])
@token_required
def get_work_types():
    """Get all work types"""
    try:
        db = get_db()
        work_types = list(db.work_types.find({}).sort('work_name', 1))
        for wt in work_types:
            wt['id'] = str(wt['_id'])
            wt['_id'] = str(wt['_id'])
        return jsonify({'success': True, 'data': work_types}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@work_type_bp.route('/<id>', methods=['GET'])
@token_required
def get_work_type(id):
    """Get single work type"""
    try:
        if not ObjectId.is_valid(id):
            return jsonify({'message': 'Invalid ID', 'success': False}), 400
        db = get_db()
        wt = db.work_types.find_one({'_id': ObjectId(id)})
        if not wt:
            return jsonify({'message': 'Work type not found', 'success': False}), 404
        wt['id'] = str(wt['_id'])
        return jsonify({'success': True, 'data': wt}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@work_type_bp.route('', methods=['POST'])
@token_required
def create_work_type():
    """Create work type"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'No data provided', 'success': False}), 400
        
        work_name = (data.get('work_name') or '').strip()
        wage_type = (data.get('wage_type') or 'per_day').lower()
        wage_per_unit = float(data.get('wage_per_unit', 0) or 0)
        wage_per_day = float(data.get('wage_per_day', 0) or 0)
        description = (data.get('description') or '').strip()
        
        if not work_name:
            return jsonify({'message': 'Work name is required', 'success': False}), 400
        
        if wage_type not in ('per_unit', 'per_day'):
            return jsonify({'message': 'wage_type must be per_unit or per_day', 'success': False}), 400
        
        if wage_type == 'per_day' and wage_per_day <= 0:
            return jsonify({'message': 'wage_per_day must be positive', 'success': False}), 400
        if wage_type == 'per_unit' and wage_per_unit <= 0:
            return jsonify({'message': 'wage_per_unit must be positive', 'success': False}), 400
        
        db = get_db()
        if db.work_types.find_one({'work_name': {'$regex': f'^{work_name}$', '$options': 'i'}}):
            return jsonify({'message': 'Work type with this name already exists', 'success': False}), 400
        
        doc = {
            'work_name': work_name,
            'wage_type': wage_type,
            'wage_per_unit': wage_per_unit if wage_type == 'per_unit' else 0,
            'wage_per_day': wage_per_day if wage_type == 'per_day' else 0,
            'description': description,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        result = db.work_types.insert_one(doc)
        doc['id'] = str(result.inserted_id)
        doc['_id'] = str(result.inserted_id)
        return jsonify({'message': 'Work type created', 'success': True, 'data': doc}), 201
    except ValueError as e:
        return jsonify({'message': str(e), 'success': False}), 400
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@work_type_bp.route('/<id>', methods=['PUT'])
@token_required
def update_work_type(id):
    """Update work type"""
    try:
        if not ObjectId.is_valid(id):
            return jsonify({'message': 'Invalid ID', 'success': False}), 400
        data = request.get_json()
        db = get_db()
        wt = db.work_types.find_one({'_id': ObjectId(id)})
        if not wt:
            return jsonify({'message': 'Work type not found', 'success': False}), 404
        
        updates = {'updated_at': datetime.utcnow()}
        if 'work_name' in data and data['work_name']:
            updates['work_name'] = str(data['work_name']).strip()
        if 'wage_type' in data:
            wage_type = str(data['wage_type']).lower()
            if wage_type in ('per_unit', 'per_day'):
                updates['wage_type'] = wage_type
        if 'wage_per_unit' in data:
            updates['wage_per_unit'] = float(data.get('wage_per_unit', 0) or 0)
        if 'wage_per_day' in data:
            updates['wage_per_day'] = float(data.get('wage_per_day', 0) or 0)
        if 'description' in data:
            updates['description'] = str(data.get('description') or '').strip()
        
        db.work_types.update_one({'_id': ObjectId(id)}, {'$set': updates})
        wt = db.work_types.find_one({'_id': ObjectId(id)})
        wt['id'] = str(wt['_id'])
        return jsonify({'message': 'Work type updated', 'success': True, 'data': wt}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@work_type_bp.route('/<id>', methods=['DELETE'])
@token_required
def delete_work_type(id):
    """Delete work type"""
    try:
        if not ObjectId.is_valid(id):
            return jsonify({'message': 'Invalid ID', 'success': False}), 400
        db = get_db()
        result = db.work_types.delete_one({'_id': ObjectId(id)})
        if result.deleted_count == 0:
            return jsonify({'message': 'Work type not found', 'success': False}), 404
        return jsonify({'message': 'Work type deleted', 'success': True}), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500
