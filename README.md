# Tahir Guest Palace — Hotel & Restaurant ERP

Hotel management and restaurant POS system for Tahir Guest Palace, Kano.
React + Vite frontend, Node/Express + PostgreSQL backend, JWT auth.

## Stack

- Frontend: React, Vite, Tailwind, Lucide, Recharts (port `5174`)
- Backend: Node, Express, PostgreSQL (port `4000`, proxy `/api` → 4000)
- Auth: JWT (bcrypt password hashes), role-based access control

## Getting started

Backend:

```bash
cd backend
npm install
cp .env.example .env   # configure Postgres connection + JWT_SECRET
npm run db:reset        # create schema + seed demo data
npm run dev             # or: node --watch src/index.js
```

Frontend:

```bash
cd frontend
npm install
npm run dev             # http://localhost:5174
```

## ACCESS CONTROL (Roles)

- **SUPER_ADMIN** — full access (equivalent to legacy ADMIN role)
- **ADMIN** — legacy full-access role, treated as SUPER_ADMIN
- **GENERAL_MANAGER** — all hotel/restaurant/inventory/finance reports, all operations
- **MANAGER** — department-level operations + reports
- **RECEPTIONIST** — rooms, reservations, guests, check-in/out, folios, invoices, payments
- **RESTAURANT_MANAGER** — assigned restaurants, tables, menu, POS, orders, restaurant reports/inventory/expenses
- **RESTAURANT_STAFF** — restaurant tables/menu/POS/orders + charge-to-room
- **ACCOUNTANT** — payments, invoices, expenses, revenue, accounting, financial reports
- **STOREKEEPER** — inventory, categories, suppliers, purchases, stock movements, low-stock, adjustments/wastage
- **HOUSEKEEPING** — assigned rooms, housekeeping tasks, room status

Authorization notes:

- Backend enforces every route with a `required(...permission)` guard and returns **HTTP 403** for denied API calls.
- Frontend hides nav items by role and redirects direct URL access via route guards.
- Permission map: `backend/src/config/permissions.js` (mirrored in `frontend/src/utils/permissions.js`) — keep both in sync.

## DEMO ACCOUNTS (DEVELOPMENT ONLY)

All demo accounts use the development password **`admin123`**.
These are placeholders for local testing only — replace with real credentials and
strong passwords before any production deployment.

| Role | Username | Email |
|------|----------|--------------------------|
| Super Admin | `admin` | `admin@tahir.local` |
| Super Admin | `superadmin` | `superadmin@tahir.local` |
| General Manager | `gm` | `manager@tahir.local` |
| Receptionist | `reception` | `reception@tahir.local` |
| Manager | `manager` | `manager.desk@tahir.local` |
| Restaurant Manager | `restman` | `restaurant@tahir.local` |
| Restaurant Staff | `pos` | `restaurant.staff@tahir.local` |
| Accountant | `account` | `accountant@tahir.local` |
| Storekeeper | `store` | `storekeeper@tahir.local` |
| Housekeeping | `hskeeper` | `housekeeping@tahir.local` |

> **WARNING:** All seed users share the dev password `admin123` and are seeded with
> `last_login` populated. Never ship these to production.
