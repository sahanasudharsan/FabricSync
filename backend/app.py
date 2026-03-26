"""FabricSync - Spinning Mill Operations Management API"""

import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from config import Config
from utils.db import init_db

# Import Blueprints
from routes.auth_routes import auth_bp
from routes.work_type_routes import work_type_bp
from routes.worker_routes import worker_bp
from routes.fabric_routes import fabric_bp
from routes.attendance_routes import attendance_bp
from routes.attendance_history_routes import attendance_history_bp
from routes.daily_usage_routes import daily_usage_bp
from routes.assignment_routes import assignment_bp
from routes.waste_routes import waste_bp
from routes.salary_routes import salary_bp
from routes.report_routes import report_bp
from routes.operations_routes import ops_bp
from routes.wage_routes import wage_bp


def create_app():
    app = Flask(__name__)

    # Config
    app.config['SECRET_KEY'] = Config.SECRET_KEY

    # Enable CORS (IMPORTANT for deployment)
    CORS(app)

    # Initialize database
    init_db()

    # Register all routes
    app.register_blueprint(auth_bp)
    app.register_blueprint(work_type_bp)
    app.register_blueprint(worker_bp)
    app.register_blueprint(fabric_bp)
    app.register_blueprint(attendance_bp)
    app.register_blueprint(attendance_history_bp)
    app.register_blueprint(daily_usage_bp)
    app.register_blueprint(assignment_bp)
    app.register_blueprint(waste_bp)
    app.register_blueprint(salary_bp)
    app.register_blueprint(report_bp)
    app.register_blueprint(ops_bp)
    app.register_blueprint(wage_bp)

    # Health check route (VERY IMPORTANT for deployment)
    @app.route('/')
    def home():
        return {"message": "FabricSync Backend Running"}

    @app.route('/api/health')
    def health():
        return {"status": "ok", "message": "FabricSync API"}

    return app


# Create app instance
app = create_app()


# Run locally
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=False)