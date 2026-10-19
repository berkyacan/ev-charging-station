# EV Charging Station Network & Management System

A full-stack prototype for finding, reserving, and paying for electric vehicle charging, with separate panels for EV drivers, station operators, and administrators.

Built as a university **Fundamentals of Software Engineering** team project to demonstrate:

- system architecture
- UI design choices
- testing strategy
- a working end-to-end demo flow
- traceability between requirements (use cases) and implementation

## Team & Roles

Team project by Group 3 (4 members), Fundamentals of Software Engineering, Ege University Computer Engineering, 2025–2026 Spring.

- **Berkay Can Benli**: requirements engineering and project documentation. This covered viewpoint analysis, the 56 functional, non-functional, and domain requirements, MoSCoW prioritization, conflict resolution, the use cases (UC-01 to UC-03), and the UML domain model.
- **Implementation:** the backend and frontend code was written by a teammate and is published here with their permission.

📄 **[Requirements Engineering Report](docs/requirements/README.md)**: the full analysis, plus a traceability table linking each requirement to the code and tests that implement it.

## Tech Stack

| Layer    | Technology                                                        |
| -------- | ----------------------------------------------------------------- |
| Backend  | NestJS 10, TypeScript, Prisma 5, PostgreSQL, JWT auth, bcrypt     |
| Frontend | React 18, TypeScript, Vite 5, React Router 6, Google Maps (optional) |
| Testing  | Jest + ts-jest (unit, DTO validation, and use-case tests)         |
| Dev DB   | PostgreSQL 16 via Docker Compose                                  |

## Architecture Summary

The project is a **modular monolith** with a layered, clean-architecture style.

- Each backend feature lives in its own NestJS module (`controller` → `service` → Prisma), with DTOs validated by `class-validator` and pure domain logic (e.g. reservation validation, charging cost summary) kept in separate `domain/` files so it can be unit tested in isolation.
- The frontend is organized by feature (`src/features/<feature>/{api,components,pages}`), with a shared API client, auth context, and role-based route guards.
- All API routes are served under the `/api` prefix.

## Repository Structure

```text
.
├── backend/
│   ├── prisma/
│   │   ├── migrations/        # SQL migrations
│   │   ├── schema.prisma      # Data model
│   │   └── seed.ts            # Demo users, vehicle, stations, chargers
│   ├── src/
│   │   ├── modules/
│   │   │   ├── admin-reports/
│   │   │   ├── auth/
│   │   │   ├── charging-sessions/
│   │   │   ├── issues/
│   │   │   ├── notifications/
│   │   │   ├── operator/
│   │   │   ├── reservations/
│   │   │   ├── shared/
│   │   │   ├── stations/
│   │   │   ├── users/
│   │   │   ├── vehicles/
│   │   │   └── wallet/
│   │   ├── prisma/
│   │   └── main.ts
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── features/          # admin, auth, chargingSessions, dashboard, history,
│   │   │                      # issues, notifications, operator, reservations,
│   │   │                      # shared, stations, vehicles, wallet
│   │   ├── router/
│   │   └── styles/
│   ├── .env.example
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Setup Instructions

### Prerequisites

- Node.js 20+
- npm
- Docker (for the local PostgreSQL database), or any PostgreSQL 14+ instance

### 1. Start the database

```bash
docker compose up -d
```

This starts PostgreSQL 16 on `localhost:5432` with database `ev_charging`, user `postgres`, password `postgres`.

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy   # apply migrations
npm run prisma:seed         # load demo data
npm run start:dev           # http://localhost:3000/api
```

Backend environment variables (`backend/.env`):

| Variable       | Description                                   | Default (example)                                                     |
| -------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| `PORT`         | API port                                      | `3000`                                                                |
| `FRONTEND_URL` | Allowed CORS origin(s), comma separated       | `http://localhost:5173`                                               |
| `DATABASE_URL` | PostgreSQL connection string                  | `postgresql://postgres:postgres@localhost:5432/ev_charging?schema=public` |
| `JWT_SECRET`   | Secret used to sign JWT access tokens         | `replace-with-a-secure-secret`                                        |

Health check: `GET http://localhost:3000/api/health`

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

Frontend environment variables (`frontend/.env`):

- `VITE_API_BASE_URL`: backend API base URL, default `http://localhost:3000/api`
- `VITE_GOOGLE_MAPS_API_KEY`: optional; enables the station map and route view. Restrict the key by HTTP referrer, because Vite embeds it in the client bundle.

## Backend Commands

Run from `backend/`:

| Command                   | Description                                 |
| ------------------------- | ------------------------------------------- |
| `npm install`             | Install dependencies                        |
| `npm run start:dev`       | Start the API in watch mode                 |
| `npm run start`           | Start the API                               |
| `npm run build`           | Compile to `dist/`                          |
| `npm run start:prod`      | Run the compiled build                      |
| `npm test`                | Run the Jest test suite                     |
| `npm run prisma:generate` | Regenerate the Prisma client                |
| `npm run prisma:migrate`  | Create/apply migrations in development      |
| `npm run prisma:seed`     | Reset tables and load demo data             |

## Frontend Commands

Run from `frontend/`:

| Command           | Description                               |
| ----------------- | ----------------------------------------- |
| `npm install`     | Install dependencies                      |
| `npm run dev`     | Start the Vite dev server                 |
| `npm run build`   | Type-check and build for production       |
| `npm run preview` | Preview the production build              |

## Database Commands

| Command                                   | Description                                   |
| ----------------------------------------- | --------------------------------------------- |
| `docker compose up -d`                    | Start the local PostgreSQL container          |
| `docker compose down`                     | Stop the container (data is kept)             |
| `docker compose down -v`                  | Stop the container and delete all data        |
| `cd backend && npx prisma migrate deploy` | Apply all migrations                          |
| `cd backend && npm run prisma:seed`       | Load demo data (clears existing rows first)   |
| `cd backend && npx prisma studio`         | Browse the database in a web UI               |

### Data Model

`User` (EV_DRIVER / OPERATOR / ADMIN, with a demo wallet balance) → `Vehicle` → `Reservation` → `ChargingSession`, plus `Station` → `Charger`, `IssueReport`, and `Notification`.

## Demo Accounts

Created by the seed script. All accounts use the password **`Demo123!`**.

| Role      | Email                            | Notes                                       |
| --------- | -------------------------------- | ------------------------------------------- |
| EV Driver | `driver.demo@evcharging.local`   | Wallet balance 650, Tesla Model 3 (CCS)     |
| Operator  | `operator.demo@evcharging.local` | Manages charger status and pricing          |
| Admin     | `admin.demo@evcharging.local`    | Views system reports                        |

Seeded stations (İzmir): **Karşıyaka Hub** (DC 50 kW CCS + AC 22 kW Type 2, available), **Bornova Station** (DC 150 kW, occupied), and **Buca Point** (DC 50 kW CHAdeMO, offline).

## Demo Flow

The main scenario goes from vehicle registration to completed and paid charging:

1. **Log in** as the EV driver, or register a new account.
2. **Register a vehicle** (`/vehicles`): brand, model, battery capacity, connector type, max power, plate number.
3. **Find a station** (`/stations`): filter by connector type, minimum power, maximum price per kWh, and time window, and view a station's details and chargers. Open the route view (`/route/:stationId`) for directions.
4. **Make a reservation** (`/reservations/new`): pick a vehicle, charger, and time slot. Before confirming, the system checks connector compatibility, the vehicle's power limit, the time range and maximum duration, how far in advance the booking is, operating hours, charger status, and overlapping bookings.
5. **Start charging** (`/charging-sessions`) from the confirmed reservation.
6. **Complete the session** by entering the energy reading. The system calculates consumed kWh and total cost.
7. **Pay** with the demo wallet or a demo card, then view the receipt on the session summary page.
8. **Review** past sessions in `/history` and alerts in `/notifications`.
9. Optionally **report an issue** with a charger (`/issues/report`).

Operator and admin views:

- **Operator** (`/operator`): change a charger's status (available / occupied / offline) and price per kWh, and view reported issues.
- **Admin** (`/admin/reports`): see an overview of revenue (paid, pending), charger utilization, user and reservation counts, hourly activity, and per-station breakdowns.

## API Overview

All endpoints are prefixed with `/api`. Endpoints other than register, login, and health require a `Bearer` JWT.

| Area              | Endpoints                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| Health            | `GET /health`                                                                                              |
| Auth              | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`                                                  |
| Users             | `GET /users`, `GET /users/:id`                                                                             |
| Vehicles          | `POST /vehicles`, `GET /vehicles/me`, `GET /vehicles/:id`                                                  |
| Stations          | `GET /stations`, `GET /stations/:id`, `GET /stations/:id/chargers`                                         |
| Reservations      | `POST /reservations/validate`, `POST /reservations`, `GET /reservations/me`, `DELETE /reservations/:id`    |
| Charging sessions | `POST /charging-sessions/start`, `POST /charging-sessions/:id/complete`, `POST /charging-sessions/:id/pay`, `GET /charging-sessions/active`, `GET /charging-sessions/:id/summary` |
| Charging history  | `GET /charging-history/me`                                                                                 |
| Wallet            | `GET /wallet/me`, `POST /wallet/top-up`                                                                    |
| Notifications     | `GET /notifications/me`, `PATCH /notifications/:id/read`                                                   |
| Issues            | `POST /issues`, `GET /operator/issues`                                                                     |
| Operator          | `PATCH /operator/chargers/:id/status`, `PATCH /operator/chargers/:id/pricing`                              |
| Admin             | `GET /admin/reports/overview`                                                                              |

## Testing

```bash
cd backend
npm test
```

The suite covers:

- **Use-case tests** mapped to the use cases in the [requirements report](docs/requirements/README.md#5-use-cases-of-the-main-scenarios): `uc01-reservation`, `uc02-charger-availability`, `uc03-charging-session`
- **Domain logic**: reservation validation, charging session cost summary
- **Services and controllers** for every module, with Prisma mocked
- **DTO validation** for all request bodies
- **Utilities**: date/time and operating-hours helpers

## Implemented Features

- JWT authentication with three roles (EV driver, operator, admin) and role-based route guards
- Vehicle registration with a unique plate number per user
- Station search with filters (connector, power, price, time window), station details, and an optional Google Maps view and route page
- Reservations with compatibility, operating-hours, availability, and overlap checks
- Charging session lifecycle: start, complete with energy reading, cost calculation, payment
- Simulated payments via a demo wallet (with top-up) or demo card, with receipt numbers
- Charging history and in-app notifications
- Issue reporting by drivers and an issue list for operators
- Operator management of charger status and pricing
- Admin overview reports
- PostgreSQL schema with Prisma migrations and a demo seed

## Simulated / Not Implemented Features

- Real payment gateway integration (payments use a demo wallet or demo card)
- Real charger hardware integration (energy readings are entered manually)
- Advanced operator analytics
- Microservices architecture
- Real-time streaming features

## Frontend Language Note

- All user-facing text in the frontend is written in Turkish.
- Technical enums, endpoints, and type names stay in English; user-facing labels, status texts, empty states, and error messages must be in Turkish.
