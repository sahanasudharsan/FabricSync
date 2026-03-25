# FabricSync

**FabricSync** is a professional web-based operations management system for spinning mills. It is designed for Admin use only (single-role system).

## Tech Stack

### Frontend
- React (Vite)
- Tailwind CSS
- Framer Motion (animations)
- Lucide React (icons)
- Recharts (charts)
- React Router
- Axios

### Backend
- Python Flask REST API
- MongoDB (PyMongo)
- JWT Authentication
- bcrypt password hashing

## Features

- **Authentication**: Admin signup, login, logout with JWT
- **Work Types**: Create work types with per-unit or per-day wages
- **Workers**: Manage workers, assign work types, track status
- **Fabric Stock**: Add, update, delete fabric; low-stock threshold alerts
- **Attendance**: Mark attendance; prevent duplicate for same date
- **Work Assignments**: Assign workers to work types with quantity/date
- **Waste Management**: Record waste with trend charts
- **Salary**: Auto-calculated from attendance (per-day) or assignments (per-unit); overtime, bonus, deductions
- **Reports**: Salary, attendance, fabric, waste – view and export CSV

## Project Structure

```
FabricSync/
├── backend/
│   ├── app.py              # Flask app entry
│   ├── config/
│   ├── routes/             # API routes
│   ├── controllers/        # Business logic (salary calc)
│   ├── utils/              # DB, auth helpers
│   ├── requirements.txt
│   └── seed_data.py        # Sample data seeder
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── services/       # API client
│   │   └── App.jsx
│   └── package.json
└── README.md
```

## Setup Instructions

### Prerequisites
- Python 3.9+
- Node.js 18+
- MongoDB (local or Atlas)

### Backend

1. Create virtual environment:
   ```bash
   cd backend
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # macOS/Linux:
   source venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Create `.env` (copy from `.env.example`):
   ```
   SECRET_KEY=your-secret-key
   MONGODB_URI=mongodb://localhost:27017/
   DB_NAME=fabricsync
   JWT_SECRET_KEY=your-jwt-secret
   ```

4. Seed sample data (optional):
   ```bash
   python seed_data.py
   ```

5. Run the server:
   ```bash
   python app.py
   ```
   Backend runs at http://localhost:5000

### Frontend

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Create `.env` (optional; Vite proxies `/api` to backend by default):
   ```
   VITE_API_URL=
   ```

3. Run dev server:
   ```bash
   npm run dev
   ```
   Frontend runs at http://localhost:5173

## Sample Test Data

After running `python seed_data.py`:

- **Admin**: `admin@fabricsync.com` / `admin123`
- **Work types**: Spinning, Winding, Packing, Quality Check (with different wage types)
- **Workers**: Sample workers assigned to work types
- **Fabrics**: Sample fabric stock (including one low-stock item)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/signup | Admin signup |
| POST | /api/auth/login | Admin login |
| GET | /api/auth/me | Current user (token required) |
| CRUD | /api/workers | Workers |
| CRUD | /api/work-types | Work types |
| CRUD | /api/fabrics | Fabrics |
| GET/POST | /api/attendance | Attendance |
| CRUD | /api/assignments | Assignments |
| GET/POST | /api/waste | Waste |
| GET/POST | /api/salary | Salary (with /calculate) |
| GET | /api/reports/* | Reports (salary, attendance, fabric, waste) |

All routes except auth require `Authorization: Bearer <token>`.

## License

MIT
