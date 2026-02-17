# DuoCode Deployment Guide

This guide covers deploying DuoCode in various environments.

## Table of Contents

1. [Ubuntu Server (Complete Guide)](#ubuntu-server-complete-guide)
2. [Static Hosting (Serverless)](#1-static-hosting-serverless)
3. [Signaling Server Deployment](#2-signaling-server-deployment)
4. [HTTPS Configuration](#3-https-configuration)
5. [Cloud Platform Deployments](#4-cloud-platform-deployments)
6. [TURN Server Setup](#5-turn-server-setup)
7. [Production Checklist](#6-production-checklist)
8. [Troubleshooting](#troubleshooting)

---

## Ubuntu Server (Complete Guide)

Comprehensive deployment guide for Ubuntu Server 20.04/22.04 LTS.

### System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 core | 2 cores |
| RAM | 512 MB | 1 GB |
| Disk | 1 GB | 5 GB |
| Ubuntu | 20.04 LTS | 22.04 LTS |
| Node.js | 18.x | 20.x LTS |

### Prerequisites - Build Locally First

Before deploying, build and prepare the application on your local machine:

```bash
# On your local machine
cd /path/to/duocode

# Install dependencies
npm install
cd server && npm install && cd ..

# Verify everything works locally
npm run dev:all
```

### Quick Deploy (5 minutes)

Fast deployment for testing:

```bash
# On your local machine - build and prepare the deployment package
cd /path/to/duocode
npm run build
tar -czvf duocode.tar.gz dist/ server/ package.json

# Copy to server via SCP
scp duocode.tar.gz user@YOUR_SERVER_IP:/tmp/

# SSH into server
ssh user@YOUR_SERVER_IP

# On the server - set up the application
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x

# Extract and set up application
sudo mkdir -p /opt/duocode
sudo tar -xzvf /tmp/duocode.tar.gz -C /opt/duocode
sudo chown -R $USER:$USER /opt/duocode
cd /opt/duocode

# Install dependencies
npm install
cd server && npm install && cd ..

# Start both services
npm run dev:all
```

Access at `http://YOUR_SERVER_IP:3000`

### Full Production Setup

#### Step 1: System Preparation (on server)

```bash
# Update system and install prerequisites
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl build-essential ufw

# Create dedicated application user (security best practice)
sudo useradd --system --shell /bin/false --home /opt/duocode duocode
```

#### Step 2: Install Node.js 20.x LTS (on server)

```bash
# Install Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version

# Install PM2 process manager globally (recommended)
sudo npm install -g pm2
```

#### Step 3: Deploy Application Files

**On your local machine:**

```bash
# Create deployment archive (excluding unnecessary files)
cd /path/to/duocode
tar -czvf duocode-deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.duocode' \
  --exclude='*.log' \
  --exclude='.env' \
  .

# Copy to server
scp duocode-deploy.tar.gz user@YOUR_SERVER_IP:/tmp/
```

**On the server:**

```bash
# Create application directory
sudo mkdir -p /opt/duocode

# Extract files
sudo tar -xzvf /tmp/duocode-deploy.tar.gz -C /opt/duocode

# Set ownership
sudo chown -R duocode:duocode /opt/duocode
cd /opt/duocode

# Install dependencies as duocode user
sudo -u duocode npm install
sudo -u duocode bash -c "cd server && npm install"

# Clean up
rm /tmp/duocode-deploy.tar.gz
```

#### Step 4: Configure Environment

```bash
# Create environment file
sudo -u duocode tee /opt/duocode/.env << 'EOF'
# DuoCode Configuration
NODE_ENV=production

# Signaling Server
PORT=3001
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
EOF

# Secure the file
sudo chmod 600 /opt/duocode/.env
sudo chown duocode:duocode /opt/duocode/.env
```

#### Step 5: Configure Firewall (UFW)

```bash
# Enable UFW
sudo ufw enable

# Allow SSH (important - don't lock yourself out!)
sudo ufw allow ssh

# Allow HTTP and HTTPS (for nginx)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# If NOT using nginx, allow direct access to app ports
# sudo ufw allow 3000/tcp
# sudo ufw allow 3001/tcp

# Check status
sudo ufw status verbose
```

#### Step 6: Create Systemd Services

**Frontend Service:**

```bash
sudo tee /etc/systemd/system/duocode-frontend.service << 'EOF'
[Unit]
Description=DuoCode Frontend Server
After=network.target

[Service]
Type=simple
User=duocode
Group=duocode
WorkingDirectory=/opt/duocode
ExecStart=/usr/bin/npx serve dist -l 3000 -s
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=duocode-frontend
Environment=NODE_ENV=production

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/duocode

[Install]
WantedBy=multi-user.target
EOF
```

**Signaling Server Service:**

```bash
sudo tee /etc/systemd/system/duocode-signaling.service << 'EOF'
[Unit]
Description=DuoCode Signaling Server
After=network.target

[Service]
Type=simple
User=duocode
Group=duocode
WorkingDirectory=/opt/duocode/server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=duocode-signaling
Environment=NODE_ENV=production
Environment=PORT=3001
EnvironmentFile=/opt/duocode/.env

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/duocode

[Install]
WantedBy=multi-user.target
EOF
```

**Enable and Start Services:**

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable services to start on boot
sudo systemctl enable duocode-frontend duocode-signaling

# Start services
sudo systemctl start duocode-frontend duocode-signaling

# Check status
sudo systemctl status duocode-frontend duocode-signaling
```

#### Step 7: Install and Configure Nginx

```bash
# Install nginx
sudo apt install -y nginx

# Create site configuration
sudo tee /etc/nginx/sites-available/duocode << 'EOF'
# DuoCode - Interview Platform

upstream duocode_frontend {
    server 127.0.0.1:3000;
}

upstream duocode_signaling {
    server 127.0.0.1:3001;
}

server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com www.your-domain.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend - static files
    location / {
        proxy_pass http://duocode_frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            proxy_pass http://duocode_frontend;
            expires 7d;
            add_header Cache-Control "public, immutable";
        }
    }

    # Signaling server - WebSocket
    location /socket.io/ {
        proxy_pass http://duocode_signaling;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeout settings
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://duocode_signaling/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/duocode /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
sudo systemctl enable nginx
```

#### Step 8: SSL/TLS with Let's Encrypt

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate (replace with your domain and email)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com \
    --non-interactive --agree-tos --email your-email@example.com

# Verify auto-renewal timer
sudo systemctl status certbot.timer

# Test renewal process
sudo certbot renew --dry-run
```

#### Step 9: Update Application Configuration

After setting up SSL, the signaling server URL can be configured via the `SIGNALING_SERVER_URL` environment variable or by editing the built application.

Also update ALLOWED_ORIGINS in .env:

```bash
sudo -u duocode nano /opt/duocode/.env
# Update: ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com

# Restart signaling service
sudo systemctl restart duocode-signaling
```

### Alternative: PM2 Process Manager

Instead of systemd, you can use PM2:

```bash
# Create PM2 ecosystem file
sudo -u duocode tee /opt/duocode/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'duocode-frontend',
      script: 'npx',
      args: 'serve dist -l 3000 -s',
      cwd: '/opt/duocode',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'duocode-signaling',
      script: 'server/server.js',
      cwd: '/opt/duocode',
      env: {
        NODE_ENV: 'production',
        PORT: '3001'
      }
    }
  ]
};
EOF

# Start services with PM2
sudo -u duocode pm2 start /opt/duocode/ecosystem.config.js

# Save PM2 process list
sudo -u duocode pm2 save

# Configure PM2 to start on boot
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u duocode --hp /opt/duocode
```

### Monitoring & Logs

**View Logs (systemd):**

```bash
# Frontend logs
sudo journalctl -u duocode-frontend -f

# Signaling server logs
sudo journalctl -u duocode-signaling -f

# Both services
sudo journalctl -u 'duocode-*' -f

# Last 100 lines
sudo journalctl -u duocode-signaling -n 100

# Logs since specific time
sudo journalctl -u duocode-signaling --since "1 hour ago"
```

**View Logs (PM2):**

```bash
# All logs
sudo -u duocode pm2 logs

# Specific service
sudo -u duocode pm2 logs duocode-signaling

# Clear logs
sudo -u duocode pm2 flush
```

**Health Check:**

```bash
# Local health check
curl http://localhost:3001/health

# Via nginx (HTTP)
curl http://your-domain.com/health

# Via nginx (HTTPS)
curl https://your-domain.com/health
```

### Update Application

To deploy updates:

**On your local machine:**

```bash
# Create updated deployment archive
cd /path/to/duocode
tar -czvf duocode-update.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.duocode' \
  --exclude='*.log' \
  --exclude='.env' \
  .

# Copy to server
scp duocode-update.tar.gz user@YOUR_SERVER_IP:/tmp/
```

**On the server:**

```bash
# Stop services
sudo systemctl stop duocode-frontend duocode-signaling

# Backup current version (optional)
sudo cp -r /opt/duocode /opt/duocode.backup

# Extract updated files
sudo tar -xzvf /tmp/duocode-update.tar.gz -C /opt/duocode

# Fix ownership
sudo chown -R duocode:duocode /opt/duocode

# Install any new dependencies
sudo -u duocode npm install
sudo -u duocode bash -c "cd server && npm install"

# Restart services
sudo systemctl start duocode-frontend duocode-signaling

# Clean up
rm /tmp/duocode-update.tar.gz
```

### Useful Commands Quick Reference

```bash
# Service status
sudo systemctl status duocode-frontend duocode-signaling

# Start/stop/restart
sudo systemctl start|stop|restart duocode-frontend
sudo systemctl start|stop|restart duocode-signaling

# View all listening ports
sudo netstat -tlnp

# Check nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# View disk space
df -h

# View memory
free -m

# Find process using port
sudo lsof -i :3001
```

---

## Deployment Options

### 1. Static Hosting (Serverless)

The frontend is fully static and can be hosted anywhere:

#### Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=.
```

Or connect your Git repository for automatic deployments.

#### Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

#### GitHub Pages

1. Push to GitHub
2. Go to Settings > Pages
3. Select branch and root folder
4. Site will be available at `https://username.github.io/repo-name`

#### Cloudflare Pages

1. Connect your Git repository
2. Build command: (leave empty)
3. Build output directory: `/`

### 2. Signaling Server Deployment

When direct P2P connections fail, the signaling server enables WebRTC connection establishment.

#### Docker Deployment

```bash
cd server

# Build image
docker build -t duocode-signaling .

# Run container
docker run -d \
  --name duocode-signaling \
  -p 3001:3001 \
  -e ALLOWED_ORIGINS="https://your-domain.com" \
  duocode-signaling
```

#### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  signaling:
    build: ./server
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - ALLOWED_ORIGINS=https://your-domain.com
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Run with:
```bash
docker-compose up -d
```

#### Ubuntu Server (Manual)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Create application directory
sudo mkdir -p /opt/duocode

# Copy files via SCP (from your local machine)
# scp -r ./server user@server:/opt/duocode/

# Install dependencies
cd /opt/duocode/server
npm install

# Create systemd service
sudo tee /etc/systemd/system/duocode-signaling.service > /dev/null <<EOF
[Unit]
Description=DuoCode Signaling Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/duocode/server
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
Environment=PORT=3001
Environment=ALLOWED_ORIGINS=*

[Install]
WantedBy=multi-user.target
EOF

# Start service
sudo systemctl daemon-reload
sudo systemctl enable duocode-signaling
sudo systemctl start duocode-signaling

# Check status
sudo systemctl status duocode-signaling
```

#### Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/duocode

# Frontend (static files)
server {
    listen 80;
    server_name duocode.example.com;

    root /var/www/duocode;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Signaling server (WebSocket proxy)
server {
    listen 80;
    server_name signaling.duocode.example.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

Enable and reload:
```bash
sudo ln -s /etc/nginx/sites-available/duocode /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. HTTPS Configuration

WebRTC requires secure context (HTTPS or localhost).

#### Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d duocode.example.com -d signaling.duocode.example.com

# Auto-renewal is configured automatically
```

#### Self-Signed (Development)

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/duocode.key \
  -out /etc/ssl/certs/duocode.crt \
  -subj "/CN=localhost"
```

### 4. Cloud Platform Deployments

#### AWS Elastic Beanstalk

1. Create `Procfile` in server directory:
```
web: node server.js
```

2. Deploy:
```bash
cd server
eb init -p node.js duocode-signaling
eb create duocode-signaling-env
eb deploy
```

#### Google Cloud Run

```bash
cd server

# Build and push
gcloud builds submit --tag gcr.io/PROJECT_ID/duocode-signaling

# Deploy
gcloud run deploy duocode-signaling \
  --image gcr.io/PROJECT_ID/duocode-signaling \
  --platform managed \
  --allow-unauthenticated \
  --port 3001
```

#### Heroku

```bash
cd server

# Login and create app
heroku login
heroku create duocode-signaling

# Deploy
git subtree push --prefix server heroku main

# Or use container
heroku container:push web
heroku container:release web
```

#### DigitalOcean App Platform

1. Connect your GitHub repository
2. Configure:
   - Source: `/server` directory
   - Build command: `npm install`
   - Run command: `node server.js`
   - Port: 3001

### 5. TURN Server Setup

For reliable connections through restrictive NATs/firewalls, deploy a TURN server.

#### Coturn on Ubuntu

```bash
# Install
sudo apt install coturn

# Configure /etc/turnserver.conf
listening-port=3478
tls-listening-port=5349
fingerprint
lt-cred-mech
user=duocode:your-secure-password
realm=duocode.example.com
server-name=duocode.example.com
cert=/etc/letsencrypt/live/turn.duocode.example.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.duocode.example.com/privkey.pem

# Enable and start
sudo systemctl enable coturn
sudo systemctl start coturn
```

Update `src/services/connection-manager.ts` with TURN credentials:

```javascript
turnServers: [
    {
        urls: 'turn:turn.duocode.example.com:3478',
        username: 'duocode',
        credential: 'your-secure-password'
    },
    {
        urls: 'turns:turn.duocode.example.com:5349',
        username: 'duocode',
        credential: 'your-secure-password'
    }
]
```

### 6. Production Checklist

#### Security
- [ ] HTTPS enabled for all endpoints
- [ ] CORS configured with specific origins
- [ ] TURN credentials are secure and rotated
- [ ] Rate limiting configured
- [ ] Security headers set (CSP, X-Frame-Options, etc.)

#### Performance
- [ ] Static assets cached
- [ ] Gzip/Brotli compression enabled
- [ ] CDN configured for static files
- [ ] WebSocket keepalive configured

#### Monitoring
- [ ] Health check endpoint monitored
- [ ] Error logging configured
- [ ] Performance metrics collected
- [ ] Alerting set up

#### Reliability
- [ ] Auto-restart on failure
- [ ] Load balancer for signaling server
- [ ] Backup STUN/TURN servers configured
- [ ] Graceful shutdown handling

### 7. Scaling Considerations

The signaling server is stateless and can be horizontally scaled:

```yaml
# Kubernetes example
apiVersion: apps/v1
kind: Deployment
metadata:
  name: duocode-signaling
spec:
  replicas: 3
  selector:
    matchLabels:
      app: duocode-signaling
  template:
    metadata:
      labels:
        app: duocode-signaling
    spec:
      containers:
      - name: signaling
        image: duocode-signaling:latest
        ports:
        - containerPort: 3001
        env:
        - name: PORT
          value: "3001"
        resources:
          limits:
            memory: "128Mi"
            cpu: "100m"
---
apiVersion: v1
kind: Service
metadata:
  name: duocode-signaling
spec:
  selector:
    app: duocode-signaling
  ports:
  - port: 80
    targetPort: 3001
  type: LoadBalancer
```

For sticky sessions with Socket.IO, use Redis adapter:

```javascript
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");

const pubClient = createClient({ url: "redis://localhost:6379" });
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server listening port |
| `ALLOWED_ORIGINS` | * | CORS allowed origins (comma-separated) |
| `NODE_ENV` | development | Environment mode |

## Health Monitoring

The signaling server exposes a health endpoint:

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "healthy",
  "uptime": 3600,
  "rooms": 5,
  "connections": 10
}
```

Use this for load balancer health checks and monitoring.

---

## Troubleshooting

### Common Issues and Solutions

#### 1. "EADDRINUSE: address already in use"

Port is already taken by another process:

```bash
# Find process using the port
sudo lsof -i :3001
sudo lsof -i :3000

# Kill the process
sudo kill -9 <PID>

# Or use fuser to kill directly
sudo fuser -k 3001/tcp
sudo fuser -k 3000/tcp
```

#### 2. WebSocket Connection Failed

**Check nginx WebSocket configuration:**

```bash
# Test nginx configuration
sudo nginx -t

# Verify socket.io location block exists
grep -A 15 "socket.io" /etc/nginx/sites-available/duocode

# Check nginx error logs
sudo tail -f /var/log/nginx/error.log
```

**Verify services are running:**

```bash
# Check both services
sudo systemctl status duocode-frontend duocode-signaling

# Test signaling server directly
curl -I http://localhost:3001/socket.io/?EIO=4&transport=polling
```

#### 3. CORS Errors

Update `ALLOWED_ORIGINS` in the environment file:

```bash
# Edit environment file
sudo nano /opt/duocode/.env

# Add your domains (comma-separated, no spaces)
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com,http://localhost:3000

# Restart signaling server
sudo systemctl restart duocode-signaling
```

#### 4. SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal

# Check certificate expiry
echo | openssl s_client -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates

# Verify nginx SSL configuration
sudo nginx -t
```

#### 5. Service Won't Start

```bash
# Check detailed service status
sudo systemctl status duocode-signaling -l

# View full error logs
sudo journalctl -u duocode-signaling -n 50 --no-pager

# Try running manually to see errors
sudo -u duocode /usr/bin/node /opt/duocode/server/server.js

# Check Node.js installation
node --version
which node
```

#### 6. Permission Denied Errors

```bash
# Fix ownership
sudo chown -R duocode:duocode /opt/duocode

# Fix permissions
sudo chmod -R 755 /opt/duocode
sudo chmod 600 /opt/duocode/.env

# Fix npm cache
sudo -u duocode npm cache clean --force

# If using PM2
sudo -u duocode pm2 delete all
sudo -u duocode pm2 start /opt/duocode/ecosystem.config.js
```

#### 7. Nginx 502 Bad Gateway

The upstream service is not responding:

```bash
# Verify services are running
sudo systemctl status duocode-frontend duocode-signaling

# Check if ports are listening
sudo netstat -tlnp | grep -E '3000|3001'

# Restart services
sudo systemctl restart duocode-frontend duocode-signaling

# Check SELinux (if enabled)
sudo setsebool -P httpd_can_network_connect 1
```

#### 8. WebRTC Peer Connection Failed

**If peers can't connect even with signaling working:**

```bash
# Check if TURN server is needed (for NAT traversal)
# Test with a TURN server or ensure both peers are on same network

# Verify firewall allows WebRTC ports
sudo ufw status

# For TURN server ports (if self-hosting)
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp
sudo ufw allow 49152:65535/udp
```

#### 9. High Memory Usage

```bash
# Check memory usage
free -m
ps aux --sort=-%mem | head

# If Node.js is consuming too much memory
# Set memory limit in systemd service
sudo nano /etc/systemd/system/duocode-signaling.service
# Add under [Service]:
# Environment=NODE_OPTIONS="--max-old-space-size=256"

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart duocode-signaling
```

#### 10. Cannot Access from External Network

```bash
# Verify firewall rules
sudo ufw status

# Check nginx is listening on all interfaces
sudo netstat -tlnp | grep nginx

# Verify DNS is pointing to server IP
dig your-domain.com

# Check cloud provider security groups/firewall
# (AWS, GCP, Azure, DigitalOcean - check their firewall settings)
```

### Debug Mode

Enable verbose logging for debugging:

```bash
# Edit environment file
sudo nano /opt/duocode/.env

# Add debug flag
DEBUG=*

# Restart service
sudo systemctl restart duocode-signaling

# View verbose logs
sudo journalctl -u duocode-signaling -f
```

### Complete Reset

If all else fails, perform a clean reinstall:

```bash
# Stop services
sudo systemctl stop duocode-frontend duocode-signaling

# Remove application
sudo rm -rf /opt/duocode

# Remove services
sudo rm /etc/systemd/system/duocode-*.service
sudo systemctl daemon-reload

# Start fresh with the Quick Deploy steps
```

### Getting Help

1. Check logs first: `sudo journalctl -u duocode-signaling -n 100`
2. Verify all services: `sudo systemctl status duocode-*`
3. Test health endpoint: `curl http://localhost:3001/health`
4. Check browser console for WebRTC errors
5. Verify firewall rules: `sudo ufw status verbose`
