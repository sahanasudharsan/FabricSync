# FabricSync Deployment Guide

## Prerequisites
- GitHub repository with the code
- MongoDB Atlas account (free tier available)
- Vercel account (for frontend)
- Render account (for backend)

## Step 1: Setup MongoDB Atlas
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account and cluster
3. Create database user with username and password
4. Get connection string: `mongodb+srv://username:password@cluster.mongodb.net/fabricsync`
5. Add your IP to whitelist (use `0.0.0.0/0` for cloud deployment)

## Step 2: Deploy Backend on Render

### Option A: Using Render Dashboard
1. Go to [Render](https://render.com) and sign up
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `fabricsync-api`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Root Directory**: `backend`
5. Add Environment Variables:
   - `SECRET_KEY`: Generate random string
   - `JWT_SECRET_KEY`: Generate random string
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `DB_NAME`: `fabricsync`
6. Click "Create Web Service"

### Option B: Using render.yaml (Recommended)
1. The `render.yaml` file is already configured
2. In Render Dashboard, click "New" → "Blueprint"
3. Connect your GitHub repository
4. Render will automatically create the services

## Step 3: Deploy Frontend on Vercel

### Option A: Using Vercel Dashboard
1. Go to [Vercel](https://vercel.com) and sign up
2. Click "New Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add Environment Variables:
   - `VITE_API_URL`: `https://your-backend-url.onrender.com`
6. Click "Deploy"

### Option B: Using Vercel CLI
1. Install Vercel CLI: `npm i -g vercel`
2. Run in project root: `vercel`
3. Follow the prompts
4. The `vercel.json` file handles the configuration

## Step 4: Update CORS Settings
After deployment, update the backend CORS origins in `backend/app.py`:
- Add your Vercel URL: `https://your-app.vercel.app`
- Add your Render URL: `https://your-api.onrender.com`

## Step 5: Test the Deployment
1. Visit your Vercel frontend URL
2. Try signing up and logging in
3. Test all features to ensure everything works

## Troubleshooting

### Common Issues:
1. **CORS Errors**: Update CORS origins in backend
2. **Database Connection**: Check MongoDB URI and IP whitelist
3. **Build Failures**: Verify all dependencies are in requirements.txt
4. **API Not Found**: Check API URL in frontend environment variables

### Environment Variable Generation:
For secure keys, use:
```bash
# Generate SECRET_KEY
python -c "import secrets; print(secrets.token_hex(32))"

# Generate JWT_SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Deployment URLs Structure
- **Frontend (Vercel)**: `https://fabricsync.vercel.app`
- **Backend (Render)**: `https://fabricsync-api.onrender.com`
- **Database**: MongoDB Atlas

## Production Considerations
1. Enable HTTPS (both platforms do this automatically)
2. Set up monitoring and alerts
3. Regular database backups
4. Update dependencies regularly
5. Monitor usage and scaling needs
