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
![alt text](internTechnicalAssesmentERD.drawio.png)

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

### 4. Running Automated Tests

Tests execute against an isolated disposable PostgreSQL test instance (never the hosted database):

```bash
# Start an isolated local disposable Postgres instance via Docker (if not already running):
docker run -d --name rrs_test_db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=rrs_test -p 5433:5432 postgres:16-alpine

# Run all automated tests (database constraints and authentication):
npm test

# Or run specific test suites:
npm run test:db    # Database constraint & concurrency test suite
npm run test:auth  # Authentication, JWT, and authorization test suite
```

The test suites validate:
- **Database Constraints**: Overlap prevention via PostgreSQL GiST exclusion constraints (`23P01`), back-to-back booking intervals `[)`, cancellation status transitions, foreign key preservation, and isolated concurrent insert races.
- **Authentication**: Argon2id password hashing and verification, timing equalization for unknown/inactive accounts, JWT signing/expiry/tamper resistance, real-time database role and deactivation verification, HttpOnly cookie configurations, CSRF origin checks, open redirect sanitization, and in-memory rate limiting.

### 5. Initial Administrator Setup CLI

An initial administrator account can be created explicitly using our secure CLI command.

```bash
npm run create-admin
```

**Security Design**:
- **Hidden Input**: You will be prompted interactively for Administrator Name, Email, and Password. Passwords are masked with `*` and hidden from the terminal.
- **No Command-Line Arguments**: Passing `--password` via `process.argv` is strictly prohibited and rejected to prevent credentials leaking into process listings (`ps`, Task Manager) and shell history.
- **Environment Variable Fallback**: In automated environments, credentials can be set via `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` environment variables.
- **Zero Insecure Defaults**: The system never hardcodes a default password.
- **Non-Destructive Guarantee**: If an account with the specified email already exists, the command strictly refuses to overwrite it, reset its password, or silently promote it.

### 6. Local Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application:
- `/login`: Clean white-and-green sign-in interface with accessible validation and password visibility toggle.
- `/workspace`: Protected workspace displaying user credentials, role badge (`Admin` or `Staff`), and secure sign-out.
- `/workspace/admin`: Protected administrator console exercising server-side `requireAdmin()` access control.

---

## Authentication & Authorization Architecture

### Flow Overview (Beginner-Friendly Explanation)

1. **User Sign-In**:
   - The user enters their email and password on `/login`.
   - The server normalizes the email (trims whitespace and converts to lowercase).
   - Passwords are **never** trimmed, lowercased, or altered, preserving exact characters and byte representations.
   - The server validates input sizes (email ≤ 255 chars, password 8–128 chars).

2. **Credential Verification & Timing Disparity Reduction**:
   - The server queries PostgreSQL for the user by normalized email.
   - **If the user does not exist or is inactive**: The server executes a dummy Argon2id verification against a pre-computed hash. This reduces obvious timing differences compared to immediate rejection; however, it does **not guarantee constant-time login** due to database query latency and system variations.
   - **If the user exists**: The server verifies the candidate password against the stored Argon2id hash.
   - **Generic Failure Messages**: Unknown email, wrong password, and inactive accounts return the identical message: `"Invalid email or password."`.

3. **Stateless JWT Session in HttpOnly Cookie**:
   - On successful authentication, the server signs a JSON Web Token (JWT) using `jose` with the `HS256` algorithm.
   - **Minimal Payload**: The JWT payload contains only the user ID as subject (`sub`). It contains no passwords, no confidential data, and no roles.
   - The JWT is transmitted in a secure cookie named `rrs_session`:
     - `HttpOnly`: Prevents client-side scripts from reading or copying the cookie directly. (Note: HttpOnly does not eliminate XSS vulnerabilities or prevent malicious injected scripts from issuing authenticated requests on the user's behalf).
     - `Secure`: Transmitted only over HTTPS in production.
     - `SameSite=Lax`: Prevents cross-site request forgery while permitting top-level navigation.
     - `Path=/`: Active across the entire domain.
     - `Max-Age=28800`: 8-hour session lifetime matching token expiration.

4. **Real-Time Server-Side Authorization (`dal.ts`)**:
   - On every protected request (`/workspace`, `/workspace/admin`, or authenticated APIs):
     - `getCurrentUser()` validates the JWT signature, expiry, issuer, and audience.
     - The server then queries the database for the user record using the verified user ID.
     - **Real-Time Role & Active Status**: If an admin changes a staff member's role or deactivates an account in the database, the change takes effect immediately on their very next request! Stale token roles are never trusted.
     - `requireUser()` redirects unauthenticated or inactive users to `/login`.
     - `requireAdmin()` ensures the active user has `role = 'ADMIN'`, redirecting staff members to `/workspace`.

5. **Generating a Strong Local JWT Secret**:
   To generate a secure 32+ character random secret for local development, run:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
   ```
   Copy the output and assign it to `JWT_SECRET` in your `.env` file. The application refuses to start if `JWT_SECRET` is missing, shorter than 32 characters, or set to a known placeholder.

---

## Architectural Limitations & Honest Disclosures

### 1. In-Memory Login Rate Limiter
- **Single-Instance Scope**: The rate limiter tracks failed login attempts in application memory.
- **Restart Reset**: When the Node.js application process restarts, in-memory attempt counts reset to zero.
- **Horizontal Scaling**: In a multi-node cluster, in-memory rate limits are not shared between instances (a shared store such as Redis would be required in multi-node deployments).
- **Forwarding Header Policy**: Arbitrary client-supplied forwarding headers (`X-Forwarded-For`) are never trusted as client identity because they are trivially spoofed. The limiter keys attempts by normalized account email to prevent brute-force attacks on user accounts regardless of IP manipulation.
- **Legitimate User Lockout Risk**: Because rate limiting is keyed on normalized account email to effectively thwart credential-stuffing without relying on untrusted/spoofable client IP headers, a malicious actor deliberately submitting 5 invalid password guesses for a specific target email will trigger the 15-minute block. During this lockout window, the legitimate account owner will also be temporarily prevented from logging in until the lockout duration expires.

### 2. Stateless JWT Logout Limitation
- **Cookie Clearing**: Logging out clears the `rrs_session` HttpOnly cookie from the browser with `Max-Age=0`.
- **Token Validity Limitation**: Because this system uses stateless JWTs without a distributed revocation table or token blacklist, a previously copied or intercepted JWT remains cryptographically valid until its 8-hour expiry. Deactivating the user account in the database, however, revokes access immediately on all subsequent requests because the server validates active status on every request.

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs the Next.js development server with Turbopack |
| `npm run build` | Builds the production application (independent of live database) |
| `npm run start` | Starts the production server |
| `npm run lint` | Runs ESLint style and quality checks |
| `npm run typecheck` | Validates TypeScript types across the codebase |
| `npm test` | Runs the complete automated test suite (database constraints & auth) |
| `npm run test:db` | Runs isolated database constraint and concurrency tests |
| `npm run test:auth` | Runs isolated authentication, JWT, and authorization tests |
| `npm run create-admin` | CLI command to safely create the initial administrator |
| `npm run prisma:generate` | Generates the Prisma 7 client |
| `npm run prisma:migrate` | Deploys versioned migrations (`prisma migrate deploy`) |

