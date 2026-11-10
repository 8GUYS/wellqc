# WellQC — Production Operations Runbook & Rollback Guide

> **Emergency Contacts:** Founder & Engineering Lead  
> **Target RTO (Recovery Time Objective):** < 15 minutes  
> **Target RPO (Recovery Point Objective):** < 24 hours (nightly automated R2 backup)

---

## 1. Quick Incident Triage Matrix

| Symptom | Probable Cause | First Action |
|---|---|---|
| **Frontend 500 / Crash** | Next.js runtime error / bad build | Check Vercel deployment logs; instant rollback to prior commit |
| **Backend 502 / Bad Gateway** | Render instance asleep or crashed | Check Render logs; restart backend service; verify health endpoint `/health` |
| **Backend 500 "Database error"** | Neon connection exhaustion or schema drift | Verify Neon dashboard status; ensure pooled connection string is active |
| **LAS Upload Failure (500)** | R2 credentials invalid or quota hit | Verify 4 `R2_*` env vars in Render; check R2 dashboard in Cloudflare |
| **Login rate limit triggered (429)** | User made > 5 attempts in 60s | Expected security behavior; tell user to wait 60s or reset password |

---

## 2. Instant Rollback Procedures

### Frontend (Vercel)
1. Go to [vercel.com](https://vercel.com) → `wellqc` project → **Deployments**.
2. Find the previous stable deployment (green checkmark).
3. Click the three dots (`...`) → **Instant Rollback**.
4. Traffic switches within 5 seconds with zero downtime.

### Backend (Render)
1. Go to [dashboard.render.com](https://dashboard.render.com) → `wellqc-backend` service.
2. Navigate to **Events** or **Deploys**.
3. Locate the previous successful commit.
4. Click **Rollback to this deploy**.
5. Render performs a rolling restart without dropping in-flight requests.

---

## 3. Database Restore from Cloudflare R2 Backup

If the database is corrupted or requires restoration to a previous state:

1. **Download latest backup from Cloudflare R2:**
   * Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **R2** → `wellqc-las-files` → `backups/`.
   * Download the latest archive: `backup_wellqc_YYYYMMDD_HHMMSS.sql.gz`.

2. **Decompress the SQL archive locally:**
   ```powershell
   # In PowerShell / terminal
   gzip -d backup_wellqc_YYYYMMDD_HHMMSS.sql.gz
   ```

3. **Restore to PostgreSQL (Neon):**
   ```bash
   psql "$DATABASE_URL" -f backup_wellqc_YYYYMMDD_HHMMSS.sql
   ```
   *Note: For safety, test the restore on a Neon dev/preview branch first before executing on production.*

---

## 4. How to Run Locally

### Prerequisites
* Python 3.11+
* Node.js 20+

### Start Local Servers
```powershell
# 1. Install frontend dependencies
npm install

# 2. Install backend dependencies
pip install -r backend/requirements.txt

# 3. Start both servers concurrently
npm run dev:all
```
* **Frontend:** `http://localhost:3000`
* **FastAPI Backend:** `http://localhost:8000`
* **API Documentation (Swagger):** `http://localhost:8000/docs`
* **Health Check:** `http://localhost:8000/health`

### Run Automated Tests
```powershell
# Run Python backend unit tests
pytest

# Run Next.js frontend Jest tests
npm test
```

---

## 5. Environment Variables Reference

| Variable | Location | Required In | Description |
|---|---|---|---|
| `DATABASE_URL` | Render / Local | All | Pooled Neon PostgreSQL connection string |
| `AUTH_SECRET` | Render / Vercel / Local | All | 32+ character HMAC session signing secret |
| `PAYSTACK_SECRET_KEY` | Render / Local | Production | Paystack secret key (`sk_live_...` or `sk_test_...`). If omitted, backend activates automatic mock checkout mode for testing |
| `PAYSTACK_PUBLIC_KEY` | Render / Vercel / Local | Production | Paystack public key (`pk_live_...` or `pk_test_...`) |
| `PAYSTACK_CALLBACK_URL` | Render / Vercel / Local | All | Gateway verification redirect URL (e.g. `http://localhost:3000/payment/verify` or `https://app.wellqc.com/payment/verify`) |
| `PAYSTACK_BASE_URL` | Render / Local | Optional | Paystack API endpoint (`https://api.paystack.co`) |
| `R2_ACCOUNT_ID` | Render | Production | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | Render | Production | Cloudflare R2 API Token Access Key |
| `R2_SECRET_ACCESS_KEY` | Render | Production | Cloudflare R2 API Token Secret Key |
| `R2_BUCKET_NAME` | Render | Production | R2 bucket name (`wellqc-las-files`) |
| `SENTRY_DSN` | Render | Optional | Backend error tracking DSN |
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel | Optional | Frontend error tracking DSN |
| `EMAIL_PROVIDER` | Render | Production | `EMAILJS` or `RESEND` |

---

## 6. Payment Operations & Admin Troubleshooting

### 6.1 Paystack Gateway & Mock Sandbox Checkout
* **Live Mode:** When `PAYSTACK_SECRET_KEY` is provided, transactions initialize through Paystack's official transaction API, and settlement occurs via webhook HMAC-SHA512 verification.
* **Sandbox / Demo Fallback Mode:** When `PAYSTACK_SECRET_KEY` is not present, the system automatically redirects to a local mock checkout flow (`/payment/verify?reference=...&mock=true`), instantly granting Pro entitlements so user testing, demo presentations, and evaluation sessions proceed uninterrupted.
* **Context Preservation:** All checkout URLs append `?wellId=<id>`. When returning to `/payment/verify`, the app fetches well context and directs the engineer to repair that specific well.

### 6.2 Administrator Operations & User Account Management
* **Admin Console Access (`/admin`):** Restricted to accounts where `User.role == "ADMIN"`.
* **Password Updates:** Admins can select any user account in the Admin Console and update credentials directly without manual database scripting.
* **1-Click Email Verification:** When users report email delivery delays or verification issues, administrators can bypass verification from the User Inspector using the **"Verify Email"** button (`POST /api/admin/users/{user_id}/verify-email`), immediately setting `isEmailVerified = True` and stamping `emailVerifiedAt`.
