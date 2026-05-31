# 🚀 FamilyFinPlan - Hostinger Deployment Guide

## Complete Step-by-Step Instructions

---

## 📋 Prerequisites
1. Hostinger hosting account (VPS or Web Hosting with Node.js support)
2. Domain connected to Hostinger
3. MongoDB Atlas account (free tier: https://cloud.mongodb.com)

---

## Step 1: Set Up MongoDB Atlas (Free Cloud Database)

1. Go to https://cloud.mongodb.com
2. Create a free account
3. Click "Build a Database" → Choose FREE tier (M0)
4. Select region closest to India (Mumbai)
5. Create cluster name: `familyfinplan`
6. Set database user:
   - Username: `familyfinplan_admin`
   - Password: (generate strong password - SAVE THIS!)
7. Click "Network Access" → "Add IP Address" → "Allow Access from Anywhere" (0.0.0.0/0)
8. Click "Connect" → "Drivers" → Copy the connection string
9. It will look like:
   ```
   mongodb+srv://familyfinplan_admin:<password>@cluster0.xxxxx.mongodb.net/familyfinplan?retryWrites=true&w=majority
   ```
   Replace `<password>` with your actual password.

---

## Step 2: Prepare Files for Upload

### Folder structure to upload:
```
/
├── server/
│   ├── server.js
│   ├── package.json
│   ├── .env              ← CREATE THIS (see below)
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Family.js
│   │   ├── Transaction.js
│   │   ├── Budget.js
│   │   ├── Loan.js
│   │   ├── Investment.js
│   │   └── Balance.js
│   └── routes/
│       ├── auth.js
│       ├── family.js
│       ├── transactions.js
│       ├── budgets.js
│       ├── loans.js
│       ├── investments.js
│       └── balances.js
├── public/
│   ├── index.html
│   ├── api.js
│   ├── favicon.svg
│   └── logo.svg
```

### Create production .env file:
```env
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://familyfinplan_admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/familyfinplan?retryWrites=true&w=majority
JWT_SECRET=GENERATE_A_64_CHARACTER_RANDOM_STRING_HERE
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://yourdomain.com
MAX_FAMILY_MEMBERS=6
```

To generate JWT_SECRET, use: https://generate-random.org/api-key-generator (64 chars)

---

## Step 3: Deploy on Hostinger

### Option A: Hostinger VPS (Recommended - ₹299/mo)

1. **Login to Hostinger** → Go to VPS panel
2. **SSH into your VPS:**
   ```bash
   ssh root@your-vps-ip
   ```

3. **Install Node.js:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   node --version  # Should show v20.x
   ```

4. **Install PM2 (process manager):**
   ```bash
   npm install -g pm2
   ```

5. **Upload project files:**
   ```bash
   # On your local machine, upload via SCP:
   scp -r ./server root@your-vps-ip:/var/www/familyfinplan/
   scp -r ./public root@your-vps-ip:/var/www/familyfinplan/
   ```
   
   Or use Hostinger's File Manager.

6. **Install dependencies:**
   ```bash
   cd /var/www/familyfinplan/server
   npm install --production
   ```

7. **Create .env file on server:**
   ```bash
   nano /var/www/familyfinplan/server/.env
   # Paste your production .env content
   # Press Ctrl+X, Y, Enter to save
   ```

8. **Start with PM2:**
   ```bash
   cd /var/www/familyfinplan/server
   pm2 start server.js --name "familyfinplan"
   pm2 save
   pm2 startup  # Auto-start on reboot
   ```

9. **Set up Nginx reverse proxy:**
   ```bash
   sudo apt install nginx
   sudo nano /etc/nginx/sites-available/familyfinplan
   ```
   
   Add this configuration:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com www.yourdomain.com;

       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

10. **Enable site & SSL:**
    ```bash
    sudo ln -s /etc/nginx/sites-available/familyfinplan /etc/nginx/sites-enabled/
    sudo nginx -t
    sudo systemctl restart nginx
    
    # Install SSL (free)
    sudo apt install certbot python3-certbot-nginx
    sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
    ```

11. **Verify:**
    - Visit https://yourdomain.com
    - Should see your app!

---

### Option B: Hostinger Web Hosting (Shared with Node.js)

If your Hostinger plan has Node.js support:

1. **Login to hPanel** → Go to "Websites" → Your domain
2. **File Manager** → Navigate to `public_html`
3. **Upload all files** from `public/` folder to `public_html/`
4. **Create subfolder** `api/` in `public_html`
5. **Upload server files** to a separate location
6. **Go to "Node.js"** section in hPanel:
   - Node.js version: 20.x
   - Application root: `/server`
   - Application startup file: `server.js`
   - Environment variables: Add all from .env

---

## Step 4: Connect Frontend to Backend

The `public/api.js` file automatically connects to your backend.
Make sure to include it in your `index.html`:

```html
<script src="/api.js"></script>
```

---

## Step 5: Test Everything

1. **Register**: Go to your site → Register with email/phone
2. **Login**: Use registered credentials
3. **Add Member**: As admin, add family members
4. **Share Invite**: Generate invite link → share via WhatsApp
5. **Transactions**: Add income/expense entries
6. **Check Dashboard**: Verify charts and stats

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| MongoDB connection fails | Check IP whitelist in Atlas, verify URI |
| 502 Bad Gateway | PM2 crashed. Run `pm2 restart familyfinplan` |
| CORS error | Verify FRONTEND_URL in .env matches domain |
| Can't login | Check MongoDB has the user, verify JWT_SECRET |
| Site loads but API fails | Check if Node server is running: `pm2 status` |

### Useful Commands:
```bash
pm2 status              # Check if app is running
pm2 logs familyfinplan  # See server logs
pm2 restart familyfinplan  # Restart app
pm2 monit              # Real-time monitoring
```

---

## 📊 Post-Deployment Checklist

- [ ] Register admin account
- [ ] Add family members
- [ ] Test invite link sharing
- [ ] Test adding transactions (income + expense)
- [ ] Verify dashboard charts work
- [ ] Test loan tracker
- [ ] Test investment tracking
- [ ] Export CSV
- [ ] Generate PDF report
- [ ] Test on mobile
- [ ] Set up Google Analytics (optional)
- [ ] Set up error monitoring (optional)

---

## 💰 Estimated Costs

| Service | Cost |
|---------|------|
| Hostinger VPS | ₹299/month |
| MongoDB Atlas (Free) | ₹0 |
| Domain (.com) | ₹799/year |
| SSL Certificate | Free (Let's Encrypt) |
| **Total** | **~₹350/month** |

---

## 🔒 Security Reminders

1. Never commit `.env` file to GitHub
2. Use a strong JWT_SECRET (64+ characters)
3. Enable HTTPS (SSL) immediately
4. Keep Node.js updated
5. Set MongoDB Network Access to VPS IP only (after deployment)
6. Enable MongoDB authentication
7. Set up daily database backups in Atlas

---

Need help? Contact: support@familyfinplan.com
