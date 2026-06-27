# FairAC - Smart Hostel AC & Billing Management System

![FairAC Banner](https://img.shields.io/badge/FairAC-Smart%20Billing-6C63FF?style=for-the-badge&logo=appveyor)

**FairAC** is an innovative, IoT-ready billing and room management system designed to enforce fair electricity usage for shared hostel and dormitory air conditioning. It solves the classic "roommate AC dispute" by providing precise, per-user billing through a prepaid digital wallet system.

## 📖 Overview

In shared dormitories, splitting the electricity bill for air conditioning is often a point of friction. FairAC introduces a transparent, session-based system where students pre-load funds into a digital wallet, start active AC sessions when they are in the room, and are billed proportionately for the power consumed during their specific active time. 

If multiple students are active in the same room, the system dynamically splits the cost. If a student's wallet runs dry, the system gracefully terminates the session.

## ✨ Key Features

- **Role-Based Access Control (RBAC):** Three distinct authorization tiers:
  - **Student:** Manage wallet, view room details, start/stop AC sessions, and view transaction history.
  - **Admin:** Hostel-specific oversight. Manage rooms, invite students to rooms, monitor live sessions, and force-stop active sessions if necessary.
  - **Super Admin:** Global system oversight. Access cross-hostel statistics, total revenue tracking, and exclusive rights to authorize wallet credit transfers.
- **Smart Session Management:** Dynamic billing distribution. A background worker periodically calculates power consumption and deducts funds from active users' wallets, automatically terminating sessions if the grace period expires or funds are depleted.
- **Digital Wallet & Ledger:** Built-in prepaid wallet system with a complete, immutable transaction ledger for auditing. 
- **Modern Glassmorphism UI:** A stunning, responsive, and highly interactive frontend built with React, featuring real-time data polling, modern typography, and sleek animations.
- **Robust Security:** JWT-based stateless authentication, bcrypt password hashing, robust input validation, and security headers to prevent unauthorized transactions.

## 🛠️ Tech Stack

### Frontend
- **React.js (v19)** - Component-based UI
- **Vite** - Lightning-fast build tool and development server
- **React Router** - Client-side routing and protected route guards
- **Tailwind CSS & Vanilla CSS** - Custom glassmorphism design system
- **Axios** - HTTP client for API requests
- **Context API** - Global state management for authentication

### Backend
- **Node.js & Express.js (v5)** - RESTful API architecture
- **PostgreSQL** - Highly reliable relational database
- **pg (Node-Postgres)** - Database driver with parameterized queries
- **JSON Web Tokens (JWT)** - Secure, stateless user authentication
- **Bcrypt.js** - Cryptographic password hashing
- **Express Validator** - Strict middleware input validation
- **Helmet & CORS** - API security and cross-origin resource sharing policies

## 🗄️ Database Architecture

FairAC relies on a highly normalized PostgreSQL database structure:
- **`users`**: Stores student, admin, and super_admin credentials and wallet balances.
- **`hostels` & `rooms`**: Relational mapping of physical infrastructure.
- **`sessions`**: Tracks active AC usage periods, mapping which users were active and calculating total units (kWh) consumed.
- **`transactions`**: An immutable ledger of all wallet activities (recharges, deductions, refunds).

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)

### 1. Database Setup
1. Create a PostgreSQL database named `fairac_db`.
2. Run the provided SQL migration scripts located in `backend/database/schema.sql` to generate the tables.
3. (Optional) Run the super admin migration script to create the master account.

### 2. Backend Setup
```bash
cd backend
npm install
```
Create a `.env` file in the `backend` directory:
```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_db_username
DB_PASSWORD=your_db_password
DB_NAME=fairac_db
JWT_SECRET=your_super_secret_jwt_key
```
Start the backend server:
```bash
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```
Start the frontend development server:
```bash
npm run dev
```
The application will be accessible at `http://localhost:5173`.

## 🔒 Default Credentials (Development)
If the database was seeded using the migration scripts, you can log in with:
- **Super Admin:** `super.admin@fairac.com` / `$uper@dmin_92`

## 🔮 Future Enhancements
- **Hardware Integration:** Connect the backend to real IoT smart plugs (e.g., Sonoff, Tuya) using MQTT to physically toggle power to the AC units.
- **Payment Gateway Integration:** Allow students to top-up their wallets using Stripe or Razorpay instead of manual admin transfers.
- **Advanced Analytics:** Implement charting libraries (e.g., Recharts, Chart.js) for historical power consumption analysis.

---
*Designed and built with a focus on fairness, transparency, and modern web standards.*
