# Resource Reservation Management System

A technical assessment project implementing an internal office Resource Reservation Management System for managing and booking office resources (meeting rooms, desks, equipment) with role-based access control and strict PostgreSQL-enforced conflict prevention.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router with Turbopack)
- **Language**: [TypeScript 5](https://www.typescriptlang.org/) (Strict mode)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **ORM & Database Client**: [Prisma 7](https://www.prisma.io/) with `@prisma/adapter-pg` driver adapter
- **Database**: PostgreSQL 17 (Hosted on Supabase via Session Pooler)
- **Runtime**: Node.js 24 (Active LTS) tracked via `.node-version` / `.nvmrc`
- **Package Manager**: `npm` (tracked with `package-lock.json`)

---

## Entity Relationship (ER) Diagram

```mermaid
erDiagram
    users {
        uuid id PK "gen_random_uuid()"
        text name "Required"
        text email "Required, Unique, Lowercase"
        text password_hash "Required, Internal only"
        UserRole role "ADMIN | STAFF, default STAFF"
        boolean is_active "Default true"
        timestamptz created_at "Default CURRENT_TIMESTAMP"
    }

    resource_categories {
        uuid id PK "gen_random_uuid()"
        text name "Required, Unique"
    }

    resources {
        uuid id PK "gen_random_uuid()"
        uuid category_id FK "References resource_categories(id) ON DELETE RESTRICT"
        text name "Required"
        text description "Optional"
        text location "Required"
        integer capacity "Optional, CHECK > 0"
        boolean is_active "Default true"
        timestamptz created_at "Default CURRENT_TIMESTAMP"
    }

    reservations {
        uuid id PK "gen_random_uuid()"
        uuid user_id FK "References users(id) ON DELETE RESTRICT (Owner)"
        uuid resource_id FK "References resources(id) ON DELETE RESTRICT"
        text purpose "Required"
        timestamptz start_at "Required"
        timestamptz end_at "Required, CHECK end_at > start_at"
        ReservationStatus status "CONFIRMED | CANCELLED, default CONFIRMED"
        timestamptz created_at "Default CURRENT_TIMESTAMP"
        timestamptz cancelled_at "Optional, Required if CANCELLED"
        uuid cancelled_by_id FK "References users(id) ON DELETE RESTRICT"
        text cancellation_reason "Optional"
    }

    resource_categories ||--o{ resources : "has"
    users ||--o{ reservations : "owns (userId)"
    users ||--o{ reservations : "cancels (cancelledById)"
    resources ||--o{ reservations : "booked in"
```

### Key Architectural Decisions

1. **UUID Primary Keys**: All models use PostgreSQL `gen_random_uuid()` to prevent ID enumeration vulnerabilities.
2. **Restrictive Foreign Keys**: All foreign key relations specify `ON DELETE RESTRICT` to preserve historical reservation and audit records; deleting a user, resource, or category will never cascade-delete existing bookings.
3. **No Redundant Tables or Columns**:
   - Roles (`ADMIN`, `STAFF`) are managed via an enum, avoiding disjoint tables for Admin and Staff.
   - Resource availability is time-dependent and calculated dynamically; no static `isAvailable` flag is stored.
4. **Data Isolation**: `password_hash` is strictly internal to the database layer. Public TypeScript types (such as `SafeUser`) never expose password hashes.
5. **Supabase PostgREST Protection**: All application tables have Row Level Security (RLS) enabled, and privileges are explicitly revoked from `anon` and `authenticated` PostgREST roles. Direct queries run through our server-only Prisma database client.

---

## Overlap Prevention & PostgreSQL GiST Constraints

### Why App-Level Checks and Unique Indexes are Insufficient

- **Race Condition Vulnerability**: In concurrent systems, checking `SELECT COUNT(*) WHERE ...` before executing an `INSERT` creates a race condition (Time-of-Check to Time-of-Use / TOCTOU). Two concurrent requests can both read 0 conflicting bookings and both insert, resulting in a double-booking.
- **Unique Constraint Limitation**: A B-tree unique constraint on `(resource_id, start_at, end_at)` only prevents duplicate *identical* intervals. It does not prevent partial overlaps (e.g., 10:00–12:00 vs. 11:00–13:00).

### The Solution: GiST Exclusion Constraint with `btree_gist`

We implement a PostgreSQL GiST (Generalized Search Tree) exclusion constraint using the `btree_gist` extension:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "reservations"
ADD CONSTRAINT "reservations_no_overlapping_confirmed"
EXCLUDE USING gist (
  "resource_id" WITH =,
  tstzrange("start_at", "end_at", '[)') WITH &&
)
WHERE ("status" = 'CONFIRMED');
```

- **Interval Semantics `[)`**: The `[start, end)` boundary includes `start_at` and excludes `end_at`. Two back-to-back bookings (e.g., 10:00–11:00 and 11:00–12:00) do not overlap, enabling immediate contiguous scheduling.
- **Partial Index Filter `WHERE (status = 'CONFIRMED')`**: Cancelled reservations are automatically excluded from the GiST index. When a reservation is cancelled, its time slot is immediately available for new confirmed reservations without modifying historical data.
- **Strict Concurrency Protection**: Any overlapping insert or update for the same resource is locked and rejected atomically at the database level with PostgreSQL error code `23P01` (`exclusion_violation`).

---

## Database Constraints Summary

Tracked versioned migrations enforce the following database rules:

1. `reservations_end_after_start`: `CHECK (end_at > start_at)` prevents backward or zero-duration bookings.
2. `resources_capacity_positive`: `CHECK (capacity IS NULL OR capacity > 0)` prevents negative or zero capacity.
3. `reservations_cancellation_consistency`:
   - When `status = 'CONFIRMED'`, `cancelled_at`, `cancelled_by_id`, and `cancellation_reason` must be `NULL`.
   - When `status = 'CANCELLED'`, `cancelled_at` and `cancelled_by_id` are strictly required (`cancellation_reason` remains optional).
4. `reservations_no_overlapping_confirmed`: GiST exclusion constraint preventing overlapping active bookings for the same resource.

---

## Getting Started

### Prerequisites

- **Node.js**: `v24.x` (Active LTS) — see `.node-version` / `.nvmrc`
- **npm**: `v11.x` or compatible
- **Docker** (Optional, for local isolated test database)

### 1. Installation

```bash
npm install
```

### 2. Configure Environment Variables

All local `.env*` files are ignored by Git to protect credentials. Both Next.js and Prisma CLI adhere to consistent resolution precedence:
**Existing process variables > `.env.local` > `.env`**

- **If you already have a configured `.env` file**: You are ready to develop! The project loads `.env` automatically.
- **Important Placeholder Policy**: If you use `.env.local`, any placeholder values copied from `.env.example` must be replaced with real values or removed entirely. Because `.env.local` takes precedence over `.env`, leaving unedited placeholders in `.env.local` will override valid credentials from `.env`.
- **If setting up a fresh environment**: Copy `.env.example` to `.env` (or `.env.local`):

```bash
cp .env.example .env
```

Populate the following variables:

```env
# Hosted Supabase PostgreSQL Session Pooler connection string
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"

# Isolated disposable test database connection (strictly required to run automated constraint tests)
# Safety Rules:
# - Must be explicitly defined (never falls back to DATABASE_URL)
# - Host must be in the local/CI allowlist: localhost, 127.0.0.1, ::1, or postgres
# - Database name must strictly equal 'rrs_test'
# - Must never match the application DATABASE_URL
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/rrs_test?sslmode=disable"

# Secret key for JWT signing (for upcoming authentication layer)
JWT_SECRET="your-secure-random-jwt-secret-placeholder"
```

### 3. Prisma Migrations and Client Generation

Generate the Prisma Client:
```bash
npm run prisma:generate
```

Deploy pending migrations to the configured database:
```bash
npm run prisma:migrate
```

*Note: In Prisma 7, connection URLs are managed in `prisma.config.ts`, and driver adapters (`@prisma/adapter-pg`) are used. Explicit local environment files are loaded automatically.*

### 4. Running Isolated Database Tests

Database constraint tests execute against an isolated disposable PostgreSQL test instance (never the hosted database):

```bash
# Start an isolated local disposable Postgres instance via Docker (if not already running):
docker run -d --name rrs_test_db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=rrs_test -p 5433:5432 postgres:16-alpine

# Run the automated database constraint test suite:
npm test
```

The test suite validates:
- Rejection of overlapping confirmed bookings on the same resource (`23P01`).
- Success of back-to-back bookings with `[)` boundaries.
- Success of concurrent bookings on different resources.
- Immediate release of reserved time slots upon cancellation.
- Rejection of invalid time ranges, zero-capacities, and invalid cancellation metadata (`23514`).
- Rejection of invalid foreign keys and cascade deletions (`23503`).
- Coordinated competing concurrent transactions through independent connections.

### 5. Local Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs the Next.js development server with Turbopack |
| `npm run build` | Builds the production application (does not require live DB) |
| `npm run start` | Starts the production server |
| `npm run lint` | Runs ESLint style checks |
| `npm run typecheck` | Validates TypeScript types across the codebase |
| `npm test` | Runs isolated database constraint and concurrency tests |
| `npm run prisma:generate` | Generates the Prisma 7 client |
| `npm run prisma:migrate` | Deploys versioned migrations (`prisma migrate deploy`) |

---

## Seeding Notice

> **Note**: Automatic demo-user seeding is intentionally deferred. Secure account seeding with properly hashed credentials will be introduced alongside the authentication module.
