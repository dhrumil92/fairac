# FairAC Security Audit Report

Pre-deployment full secret safety pass. Every file in `backend/` and `mobileApp/` was scanned.

---

## Summary Table

| # | Secret / Issue | Location | Severity | Status |
|---|---|---|---|---|
| 1 | Hardcoded super admin password `$uper@dmin_92` | `scripts/migration_super_admin.js:11` | 🔴 CRITICAL | ✅ **FIXED** |
| 2 | Hardcoded admin password `Admin@1234` | `scripts/set_admin_password.js:14` | 🔴 CRITICAL | ✅ **FIXED** |
| 3 | Hardcoded backend IP `10.202.106.220:5000` | `mobileApp/.../axios.js:12` | 🟡 LOW | ⚠️ Expected (see note) |
| 4 | Firebase API key in `google-services.json` | `mobileApp/application/google-services.json:18` | 🟡 LOW | ✅ Safe by design |
| 5 | Stack trace exposed in dev mode | `src/middleware/errorHandler.js:52` | 🟢 OK | ✅ Safe (dev-only guard) |
| 6 | `password_hash` fetched in DB query | `src/modules/auth/auth.service.js:186` | 🟢 OK | ✅ Safe (never returned) |
| 7 | `.env` not in mobile `.gitignore` | `mobileApp/application/.gitignore:34` | 🟡 LOW | ⚠️ See note |
| 8 | `FRONTEND_URL` not in `.env.example` | `backend/.env.example` | 🟡 LOW | ✅ **FIXED** |

---

## Findings Detail

### ✅ Fixed — Critical Issues

#### 1. Hardcoded Super Admin Password
**File:** [migration_super_admin.js](file:///g:/Project/FairAC/backend/scripts/migration_super_admin.js)

The literal password `'$uper@dmin_92'` was directly in source code and committed to git.

```diff
- const hashedPassword = await bcrypt.hash('$uper@dmin_92', saltRounds);
+ const rawPassword = process.env.SUPER_ADMIN_PASSWORD;
+ const hashedPassword = await bcrypt.hash(rawPassword, saltRounds);
```

**To run this script on Oracle Cloud:**
```bash
SUPER_ADMIN_PASSWORD=YourNewStrongPassword node scripts/migration_super_admin.js
```

#### 2. Hardcoded Admin Password
**File:** [set_admin_password.js](file:///g:/Project/FairAC/backend/scripts/set_admin_password.js)

The literal password `'Admin@1234'` was in source code.

```diff
- const hash = await bcrypt.hash('Admin@1234', 10);
+ const rawPassword = process.env.ADMIN_PASSWORD;
+ const hash = await bcrypt.hash(rawPassword, 10);
```

#### 3. `.env.example` Missing Variables
**File:** [.env.example](file:///g:/Project/FairAC/backend/.env.example)

Added `FRONTEND_URL`, `SUPER_ADMIN_PASSWORD`, and `ADMIN_PASSWORD` documentation.

---

### ⚠️ Notes (Not Fixed — Intentional)

#### Hardcoded Backend IP in Mobile App
**File:** [axios.js](file:///g:/Project/FairAC/mobileApp/application/src/api/axios.js) — Line 12

The IP `http://10.202.106.220:5000` is your **local development LAN IP**. This is standard Expo development practice — you cannot use `localhost` on a physical Android device. **Before building the production APK, you MUST change this to your Oracle Cloud public IP or domain.** For example:
```js
const API_BASE_URL = 'https://your-oracle-public-ip:5000/api/v1';
```

#### Firebase API Key in `google-services.json`
The `AIzaSy...` key is a **Firebase Android API key**. This is **safe by design** — Google intentionally exposes this key client-side. It is restricted to your specific `com.dhrumil92.application` package name and cannot be misused without a legitimate APK signed with your keystore.

#### Stack Trace in Dev Mode
`errorHandler.js` sends `response.stack` only when `NODE_ENV === 'development'`. When you deploy on Oracle Cloud with `NODE_ENV=production`, this is automatically suppressed. ✅

#### `password_hash` in Login Query
The login query fetches `password_hash` from the DB, but the login function **explicitly builds a safe return object** that excludes it. The hash never reaches the API response. ✅

---

## ✅ Already Good

| Item | Status |
|---|---|
| All DB credentials use `process.env.*` | ✅ |
| JWT_SECRET uses `process.env.JWT_SECRET` | ✅ |
| bcrypt salt rounds use `process.env.*` | ✅ |
| `.env` is in `backend/.gitignore` | ✅ |
| No Supabase, Stripe, OpenAI, or Twilio keys present | ✅ |
| No database connection strings (postgres://) hardcoded | ✅ |
| No OAuth client secrets present | ✅ |
| Mobile app has no sensitive env vars (no `REACT_APP_SECRET`) | ✅ |
| CORS locks down to `FRONTEND_URL` in production | ✅ |
| helmet() sets secure HTTP headers | ✅ |

---

## 🔴 Git History Warning

> [!CAUTION]
> **Both hardcoded passwords (`$uper@dmin_92` and `Admin@1234`) exist in git history** from previous commits. Even though the source code is now fixed, the old values are still recoverable from `git log`.
>
> **Action Required:** Before pushing to GitHub or any public repo, you MUST rotate these passwords:
> 1. Change the super admin's password directly in the database.
> 2. Change any admin user's password that may have been set using `Admin@1234`.
>
> If the repository is **private and only on your local machine**, this is lower risk — but you should still rotate the passwords before Oracle Cloud deployment.

---

## Production Deployment Checklist

Before running `eas build`, confirm:
- [ ] `JWT_SECRET` is a long random string (min 32 chars, e.g. `openssl rand -hex 32`)
- [ ] `DB_PASSWORD` is a strong unique password (not `admin123`)
- [ ] `NODE_ENV=production` on Oracle Cloud server
- [ ] `FRONTEND_URL` set to your real domain/IP in production `.env`
- [ ] Update `API_BASE_URL` in `axios.js` to your Oracle Cloud public IP/domain
- [ ] Rotate both previously hardcoded passwords in the live DB
