"""JWT and authentication utilities"""
from functools import wraps
from flask import request, jsonify
import jwt
from config import Config

def token_required(f):
    """Decorator for JWT-protected routes"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'message': 'Token is missing', 'success': False}), 401
        
        try:
            payload = jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=[Config.JWT_ALGORITHM])
            request.current_user = payload
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired', 'success': False}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token', 'success': False}), 401
        
        return f(*args, **kwargs)
    return decorated
