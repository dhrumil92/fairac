# Privacy and Data Security Audit Plan

This document outlines the complete audit of how personal data moves through the FairAC ecosystem, mapping data collection points, identifying vulnerabilities, and proposing an implementation plan to secure the system.

## 1. Data Collection Points & Movement

| Data Collected | Where it Enters | Storage Location | Where it travels / Externals |
|---|---|---|---|
| **Name** | Mobile App / Web App Registration | DB: `users` table | Sent to clients via `/auth/me` and `/sessions/*` for roommates. Used in Push Notification text. |
| **Email** | Mobile App / Web App Registration | DB: `users` table | Stored securely. No external email service is currently integrated. |
| **Mobile Number** | Mobile App Registration | DB: `users` table | Used as an alternative login identifier. |
| **Password** | Mobile App / Web App Registration | DB: `users` table (Hashed) | Never sent anywhere. Hashed immediately on the backend via `bcrypt`. |
| **Push Token** | Mobile App (Expo) | DB: `users` table | Sent to Expo's push notification servers along with notification text. |
| **Room/Hostel** | Mobile App / Web App | DB: `room_members`, `rooms` | Used to scope access rights and visibility. |

## 2. Proposed Changes

### A. Clean All Logs
**Current Issue:** `console.log()` statements exist in backend scripts, utility functions (e.g., `push.js`), and frontend hooks (`useBLE.js`, `SessionScreen.js`).
**Fix:**
- Search and remove/redact any `console.log()` that might output a user object, push token, or API payload.
- Specifically audit `auth.controller.js`, `auth.service.js`, and `push.js`.

### B. Audit Third-Party Integrations
**Current Issue:** The only third-party service in use is **Expo Push Notifications**.
**Fix:**
- Ensure the push notification `data` payload does not contain PII like phone numbers or emails.
- Currently, it only sends `session_id`, `type`, and `categoryId`, which is safe. Notification *titles/bodies* contain the roommate's first name, which is acceptable and necessary context. No changes required here.

### C. Password Handling
**Current State:** 
- Passwords are hashed using `bcrypt` (cost factor 10) in `auth.service.js` before DB insertion. 
- Plaintext passwords are not logged or stored.
**Fix:** 
- Ensure that `password_hash` is **never** returned in API responses. I will audit the `SELECT * FROM users` queries (especially in `auth.service.js` and `admin.service.js`) and implement field-level filtering to exclude `password_hash`.

### D. Cookie and Storage Audit
**Current Issue:** 
- The Mobile App stores `fairac_user` (which contains PII like email and mobile) in `AsyncStorage`.
- The Web App stores `fairac_user` in `localStorage`. 
- Storing PII in plaintext local storage is vulnerable to XSS and physical device compromises.
**Fix:**
- **Frontend & Mobile:** Remove `fairac_user` from `localStorage`/`AsyncStorage`. 
- The client should only store the JWT (`fairac_token`). 
- On app load, the client will fetch the user object freshly from `/api/v1/auth/me`. 
- *(Note: Migrating to `expo-secure-store` for the token is recommended for production, but to avoid breaking current expo environments or introducing native linking issues in this codebase, we will stick to `AsyncStorage` for the token, but strictly remove all PII).*

### E. API Response Filtering
**Current Issue:** Endpoints might return more data than necessary.
**Fix:**
- Audit `/api/v1/auth/me`, `/api/v1/sessions/my`, and `/api/v1/users/*` to ensure fields like `password_hash`, `push_token`, or excessive wallet details of *other* users are not leaked to the client.

## User Review Required

> [!WARNING]
> **Storage Changes:** Removing `fairac_user` from local storage means the app will require a quick network request to `/auth/me` on startup to load the user's name/email. If the user opens the app completely offline (and hasn't kept the app running in the background), their name/email might briefly show as "Loading" or empty until connection is restored. The core BLE flow will still work securely using the cached token.

Are you okay with proceeding with these security enhancements?
