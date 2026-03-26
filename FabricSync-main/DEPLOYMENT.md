# Deployment Environment Variables

## Backend Environment Variables

### Required for all deployments:
- `SECRET_KEY`: Flask secret key for sessions
- `JWT_SECRET_KEY`: JWT token signing secret
- `MONGODB_URI`: MongoDB connection string
- `DB_NAME`: MongoDB database name (default: fabricsync)

### For Render:
- `PYTHON_VERSION`: Set to "3.9"

## Frontend Environment Variables

### For Production:
- `VITE_API_URL`: Backend API URL (optional, auto-detected if not set)

## Platform-Specific Setup

### Vercel Environment Variables:
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Add the backend variables above
3. For MongoDB, use MongoDB Atlas or similar cloud service

### Render Environment Variables:
1. Go to Render Dashboard → Service → Environment
2. The render.yaml file automatically sets up most variables
3. Add MongoDB connection string manually if needed

### MongoDB Setup:
1. Create a free MongoDB Atlas account
2. Create a cluster
3. Get connection string
4. Add your IP to whitelist (0.0.0.0/0 for cloud deployment)
5. Use the connection string as MONGODB_URI
