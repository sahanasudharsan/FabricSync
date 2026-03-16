"""Authentication routes"""
from flask import Blueprint, request, jsonify
import jwt
from datetime import datetime
from bson import ObjectId

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

def get_db():
    from utils.db import get_db
    return get_db()

def get_config():
    from config import Config
    return Config

@auth_bp.route('/signup', methods=['POST'])
def signup():
    """Admin signup - single role system"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'No data provided', 'success': False}), 400
        
        name = (data.get('name') or '').strip()
        email = (data.get('email') or '').strip().lower()
        password = data.get('password')
        
        if not name or not email or not password:
            return jsonify({'message': 'Name, email and password are required', 'success': False}), 400
        
        if len(password) < 6:
            return jsonify({'message': 'Password must be at least 6 characters', 'success': False}), 400
        
        db = get_db()
        if db.users.find_one({'email': email}):
            return jsonify({'message': 'Email already registered', 'success': False}), 400
        
        import bcrypt
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12))
        
        user = {
            'name': name,
            'email': email,
            'password': hashed.decode('utf-8'),
            'role': 'admin',
            'created_at': datetime.utcnow()
        }
        result = db.users.insert_one(user)
        user['_id'] = str(result.inserted_id)
        del user['password']
        user['id'] = user['_id']
        
        return jsonify({
            'message': 'Admin registered successfully',
            'success': True,
            'user': user
        }), 201
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """Admin login - returns JWT token"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'No data provided', 'success': False}), 400
        
        email = (data.get('email') or '').strip().lower()
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'message': 'Email and password are required', 'success': False}), 400
        
        db = get_db()
        user = db.users.find_one({'email': email})
        if not user:
            return jsonify({'message': 'Invalid credentials', 'success': False}), 401
        
        import bcrypt
        if not bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
            return jsonify({'message': 'Invalid credentials', 'success': False}), 401
        
        config = get_config()
        token = jwt.encode(
            {'user_id': str(user['_id']), 'email': user['email'], 'role': user['role']},
            config.JWT_SECRET_KEY,
            algorithm=config.JWT_ALGORITHM
        )
        
        return jsonify({
            'message': 'Login successful',
            'success': True,
            'token': token,
            'user': {
                'id': str(user['_id']),
                'name': user['name'],
                'email': user['email'],
                'role': user['role']
            }
        }), 200
    except Exception as e:
        return jsonify({'message': str(e), 'success': False}), 500

@auth_bp.route('/me', methods=['GET'])
def me():
    """Get current user - requires token"""
    from utils.auth import token_required
    # Import here to avoid circular import
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return jsonify({'message': 'Token missing', 'success': False}), 401
    try:
        config = get_config()
        payload = jwt.decode(token, config.JWT_SECRET_KEY, algorithms=[config.JWT_ALGORITHM])
        db = get_db()
        user = db.users.find_one({'_id': ObjectId(payload['user_id'])})
        if not user:
            return jsonify({'message': 'User not found', 'success': False}), 404
        return jsonify({
            'success': True,
            'user': {
                'id': str(user['_id']),
                'name': user['name'],
                'email': user['email'],
                'role': user['role']
            }
        }), 200
    except Exception:
        return jsonify({'message': 'Invalid token', 'success': False}), 401
