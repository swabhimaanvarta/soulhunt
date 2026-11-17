# AIEM Hunt — Production Deployment & Database Administration Guide

This guide details the complete deployment process, database architecture, and production administration procedures for **AIEM Hunt**, the campus lost-and-found augmented investigation platform and treasure hunt RPG.

---

## 1. System Architecture & Prerequisites

- **Frontend & API Gateway:** Next.js 15.1 (App Router), React 19, TypeScript 5.7, Tailwind CSS.
- **Database Engine:** MongoDB 6.0+ / 7.0+ / 8.0+ or **MongoDB Atlas** (Replica Set enabled for atomic multi-document transactions).
- **Runtime Environment:** Node.js `>= 20.10.0 LTS` or Alpine Linux container.
- **Image Processing:** Sharp (native WebP transcoding and EXIF sanitization).
- **Audio Synthesizer:** Zero-dependency Web Audio API procedural synthesizer (client-side).

---

## 2. Professional Database Setup & Architecture

AIEM Hunt uses Mongoose 8 with a serverless-optimized connection pool, resilient reconnection logic, and automated index synchronization.

### 2.1 Setting Up Managed Cloud Database (MongoDB Atlas)

1. Create a cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (Free tier M0 or production M10+).
2. **Database Access:** Create an institutional database user with `readWriteAnyDatabase` or scoped `readWrite` on `aiem_hunt`.
3. **Network Access:**
   - For serverless deployments (Vercel, AWS Lambda), add IP access `0.0.0.0/0` (secured with strong user credentials).
   - For VPS / dedicated server deployments, whitelist your static host IP.
4. **Connection String Format:**
   ```env
   MONGODB_URI="mongodb+srv://<db_user>:<db_password>@<cluster>.mongodb.net/aiem_hunt?retryWrites=true&w=majority&appName=AIEMHunt"
   ```

### 2.2 Synchronizing Production Indexes (`npm run db:index`)

In production, Mongoose `autoIndex` is automatically disabled to eliminate cold-boot write locks and latency spikes. Before routing live student traffic, execute the authoritative index synchronizer:

```bash
# Workspace root
npm run db:index

# Or inside aiem-hunt
npm run db:index
```

**What this command does:**
- Connects to your target production/staging database.
- Iterates across all **28 domain models** and synchronizes all **114 indexes**.
- Automatically reconciles and updates conflicting indexes (e.g. TTL indexes, unique sparse compound keys).
- Logs a detailed audit of every verified index key, uniqueness flag, and TTL expiration.

### 2.3 Inspecting Database Health & Latency (`npm run db:check`)

Verify database connectivity, wire protocol version, cluster topology, and round-trip read/write latency:

```bash
npm run db:check
```

Example verified output:
```
🩺 AIEM HUNT — DATABASE HEALTH & LATENCY INSPECTOR
✅ Connection Established in 63ms
📡 Ping Latency: 11ms (MongoDB v8.2.5)
🧪 Ephemeral Write / Read Probe: PASSED (Write: 142ms, Read: 17ms)
📊 Active Collections Inventory: 28 collections verified
🎉 DATABASE HEALTH CHECK: HEALTHY
```

---

## 3. Production Environment Variables Configuration

Copy `.env.example` to `.env.local` or populate in your hosting platform dashboard:

| Variable | Requirement | Description | Example / Default |
| :--- | :--- | :--- | :--- |
| `MONGODB_URI` | **Required** | Production MongoDB connection string | `mongodb+srv://.../aiem_hunt` |
| `ALLOW_REMOTE_DB` | Optional | Set to `"true"` if connecting to cloud DB in development mode | `true` |
| `NEXTAUTH_URL` | **Required** | Canonical base URL of the deployed application | `https://hunt.aiemgoa.ac.in` |
| `NEXT_PUBLIC_APP_URL` | **Required** | Publicly accessible URL for frontend client links | `https://hunt.aiemgoa.ac.in` |
| `JWT_SECRET` | **Required** | Cryptographic secret for signing session JWTs ($\ge 32$ chars) | Generate via `openssl rand -base64 32` |
| `VARIANT_SECRET` | **Required** | HMAC cryptographic seed for course AI anti-cheat variants | Generate via `openssl rand -hex 32` |
| `ALLOW_DESTRUCTIVE_SEED` | **Strict Guard** | Must remain `"false"` in production to protect live data | `false` |
| `SMTP_HOST` | Recommended | Institutional SMTP host for email OTP verification | `smtp.gmail.com` |
| `SMTP_PORT` | Recommended | SMTP TLS port | `587` |
| `SMTP_USER` | Recommended | Institutional mailer email | `admin@aiemgoa.ac.in` |
| `SMTP_PASS` | Recommended | Institutional app password | `xxxx xxxx xxxx xxxx` |
| `SMTP_FROM` | Recommended | Sender display name | `AIEM Hunt <security@aiemgoa.ac.in>` |
| `AI_PRIMARY_PROVIDER` | Optional | AI quest generator provider: `"AUTO"`, `"GEMINI"`, `"OPENAI"` | `AUTO` |
| `GEMINI_API_KEY` | Optional | Free Google AI Studio API key | `AIzaSy...` |
| `OPENAI_API_KEY` | Optional | OpenAI API key for GPT-4o mini fallback | `sk-proj-...` |

---

## 4. Deployment Option A: Vercel (Serverless PaaS)

Vercel is the native hosting platform for Next.js 15:

1. Push your repository to GitHub / GitLab.
2. Import the project in Vercel:
   - **Root Directory:** `aiem-hunt`
   - **Framework Preset:** Next.js
   - **Build Command:** `next build`
   - **Output Directory:** `.next`
3. Add all Environment Variables in **Project Settings $\rightarrow$ Environment Variables**.
4. Deploy! Vercel automatically deploys edge routes, optimizes serverless connection pools, and configures CDN caching.
5. Post-deployment: Run `npm run db:index` against your production MongoDB Atlas database.

---

## 5. Deployment Option B: Docker & Docker Compose (Self-Hosted / VPS)

For deploying on a campus Linux server, AWS EC2, Hetzner, or DigitalOcean droplet:

### 5.1 Quick Start with Docker Compose

From the workspace root (`AIEM HUNT`):

```bash
# 1. Start full production stack (Next.js app + MongoDB 7.0 with persistent volumes)
docker compose up -d --build

# 2. View container logs
docker compose logs -f app

# 3. Synchronize database indexes inside the container
docker compose exec app npm run db:index
```

### 5.2 Multi-Stage Dockerfile Highlights

- **Base Image:** `node:20-alpine` (minimal security surface area).
- **Standalone Build:** Uses Next.js 15 `output: "standalone"`, reducing container image size from ~1.5 GB to **< 180 MB**.
- **Non-Root Execution:** Runs under dedicated unprivileged `nextjs` system user (`UID 1001`).
- **Built-in Health Check:** Queries containerized `/api/health` probe every 30 seconds.

### 5.3 Production Reverse Proxy (Nginx with Let's Encrypt SSL)

Place Nginx in front of port 3000:

```nginx
server {
    listen 80;
    server_name hunt.aiemgoa.ac.in;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name hunt.aiemgoa.ac.in;

    ssl_certificate /etc/letsencrypt/live/hunt.aiemgoa.ac.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hunt.aiemgoa.ac.in/privkey.pem;

    # Max upload size for evidence photos
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 6. Automated Health Monitoring & Telemetry (`/api/health`)

AIEM Hunt provides a standardized, real-time health check endpoint at `/api/health`.

### 6.1 Probe Response Format

`GET /api/health` returns HTTP 200 (healthy) or HTTP 503 (degraded/disconnected):

```json
{
  "status": "healthy",
  "timestamp": "2026-11-17T06:47:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "uptimeSeconds": 14205,
  "database": {
    "status": "connected",
    "latencyMs": 11,
    "host": "cluster0.mongodb.net",
    "name": "aiem_hunt"
  },
  "system": {
    "nodeVersion": "v20.18.0",
    "rssMemoryMb": 82,
    "heapUsedMb": 45
  },
  "durationMs": 14
}
```

### 6.2 Uptime & Monitoring Integrations

Point external monitors (e.g. BetterStack, UptimeRobot, Datadog, AWS Route53) to `https://hunt.aiemgoa.ac.in/api/health`.

---

## 7. Database Backup, Restore & Disaster Recovery

### 7.1 Automated Daily Backup Script (`backup.sh`)

```bash
#!/bin/bash
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/var/backups/aiem_hunt/$TIMESTAMP"
MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/aiem_hunt"

mkdir -p "$BACKUP_DIR"
mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR" --gzip

# Keep only the last 14 days of backups
find /var/backups/aiem_hunt/* -maxdepth 0 -type d -ctime +14 -exec rm -rf {} +
echo "✅ AIEM Hunt backup completed: $BACKUP_DIR"
```

### 7.2 Point-in-Time Restore Procedure

```bash
# Restore to target database
mongorestore --uri="$TARGET_MONGODB_URI" --nsInclude="aiem_hunt.*" --gzip /var/backups/aiem_hunt/20261117_060000/aiem_hunt/
```

---

## 8. Production Security Certification Checklist

- [x] **0 Plaintext PINs/OTPs:** All verification codes hashed via bcrypt (`ClaimRequest.handoverCodeHash`, `User.emailOtpHash`).
- [x] **Strict DTO Redaction:** Sensitive locker receipt codes, raw photos, and secret identifiers stripped from visitor/hunter responses.
- [x] **Production Headers:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Permissions-Policy`.
- [x] **Anti-Tampering:** Course-aligned AI clues generated with HMAC-SHA256 student-specific cryptographic seeds.
- [x] **Destructive Seed Lock:** `ALLOW_DESTRUCTIVE_SEED=false` hard-locked in production.
- [x] **Standalone Container:** Docker multi-stage build running under unprivileged user (`nextjs:nodejs`).
- [x] **Health Check Endpoint:** Production `/api/health` reporting live database latency and container status.
- [x] **114 Verified Indexes:** Compound uniqueness, TTL auto-expiry, and query optimization indexes confirmed.

