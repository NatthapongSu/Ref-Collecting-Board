# GitHub Pages Deployment Guide

This guide will help you deploy Art Board to GitHub Pages.

## 📋 Prerequisites

- GitHub account
- Git installed on your computer
- Node.js and npm installed

## 🚀 Deployment Steps

### 1. Create a GitHub Repository

1. Go to [GitHub](https://github.com) and sign in
2. Click the **+** button in the top right → **New repository**
3. Name your repository (e.g., `art-board`)
4. Make it **Public** (required for free GitHub Pages)
5. **Don't** initialize with README (we already have one)
6. Click **Create repository**

### 2. Push Your Code to GitHub

Open your terminal in the project directory and run:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Art Board v0.9.3"

# Add your GitHub repository as remote
# Replace YOUR_USERNAME and YOUR_REPO with your actual values
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 3. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** tab
3. In the left sidebar, click **Pages**
4. Under **Source**, select **GitHub Actions**
5. The workflow will automatically deploy when you push to `main` or `master` branch

### 4. Wait for Deployment

The GitHub Actions workflow will:
- Build your project
- Deploy to GitHub Pages
- This takes about 1-2 minutes

### 5. Access Your Live Site

Once deployed, your site will be available at:
```
https://YOUR_USERNAME.github.io/YOUR_REPO/
```

For example: `https://johndoe.github.io/art-board/`

## 🔄 Automatic Updates

Every time you push changes to the `main` or `master` branch, GitHub Actions will automatically:
1. Build the project
2. Deploy the new version
3. Your site will be updated within 1-2 minutes

## 🛠️ Troubleshooting

### Build Fails
- Check the **Actions** tab in your repository for error logs
- Make sure all dependencies are in `package.json`
- Verify Node.js version is compatible

### Page Not Found (404)
- Wait 2-3 minutes after first deployment
- Check that GitHub Pages is enabled in Settings
- Verify the URL format: `https://USERNAME.github.io/REPO/`

### Assets Not Loading
- The `base` path in `vite.config.js` is set to `./` for relative paths
- This should work for most GitHub Pages setups
- If issues persist, you may need to adjust the base path to match your repo name

### Workflow Not Running
- Check that the workflow file exists at `.github/workflows/deploy.yml`
- Verify you pushed to `main` or `master` branch
- Check the **Actions** tab for workflow status

## 📝 Manual Deployment (Alternative)

If you prefer manual deployment instead of GitHub Actions:

1. Build the project:
   ```bash
   npm run build
   ```

2. Install gh-pages:
   ```bash
   npm install -D gh-pages
   ```

3. Add to `package.json`:
   ```json
   "scripts": {
     "deploy": "gh-pages -d dist"
   }
   ```

4. Deploy:
   ```bash
   npm run deploy
   ```

## 🎯 Custom Domain (Optional)

You can use a custom domain with GitHub Pages:

1. In your repository, go to **Settings** → **Pages**
2. Under **Custom domain**, enter your domain
3. Configure DNS settings with your domain provider
4. Enable **Enforce HTTPS**

## 📊 Deployment Status

Check deployment status:
- Go to your repository
- Click **Actions** tab
- View workflow runs and their status

## 🔐 Repository Visibility

- **Public repositories**: Free GitHub Pages hosting
- **Private repositories**: Requires GitHub Pro for Pages hosting

## 📦 What Gets Deployed

Only the `dist/` folder is deployed, which contains:
- Optimized HTML, CSS, and JavaScript
- Compressed assets
- No source code or development files

## 🎉 You're Done!

Your Art Board is now live on GitHub Pages. Share the URL with others and start collecting art references!

---

**Need help?** Check the main [README.md](./README.md) for usage instructions.
