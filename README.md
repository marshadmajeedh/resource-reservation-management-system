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
- **Cookie Clearing**: Logging out clears the `rrs_session` HttpOnly cookie from the browser with `Max-Age=0`. Logout clears the cookie but does not revoke a copied JWT before expiry.
- **Token Validity Limitation**: Because this system uses stateless JWTs without a distributed revocation table or token blacklist, a previously copied or intercepted JWT remains cryptographically valid until its 8-hour expiry. Deactivating the user account in the database, however, revokes access immediately on all subsequent requests because the server validates active status on every request.

---

## Resource & Category Management Architecture

### 1. Permissions & Access Control
- **Staff (Authenticated Active Users)**:
  - May browse active resources via `/workspace/resources`.
  - May view individual resource specifications via `/workspace/resources/[id]`.
  - Queries are strictly enforced on the server (`isActive: true`). Inactive resources return `404 Not Found` for staff requests.
- **Administrators (`ADMIN`)**:
  - Full management of categories (`/workspace/admin/categories`): creating and renaming categories.
  - Full management of resources (`/workspace/admin/resources`): creating, editing, and activating/deactivating resources.
  - Can view inactive resources in management consoles and detail views.
  - Server actions strictly verify CSRF mutation origin (`validateMutationOrigin`) and real-time database user role (`requireAdmin()`). Browser role parameters or client flags are never trusted.

### 2. Category & Resource Validation Rules
- **Resource Categories**:
  - `name`: Required, trimmed, 1–100 characters. Blank or whitespace-only inputs are rejected.
  - Uniqueness: Handled cleanly via database constraint violation (`P2002`). Returns friendly error message (`"A category with this name already exists."`).
  - No deletion: Category deletion is omitted in this scope to preserve referential integrity with resources.
  - Form integration: Resource forms dynamically fetch categories from the database; hardcoded categories are prohibited. If no categories exist, administrators are prompted to create a category first.
- **Resources**:
  - `name`: Required, trimmed, 1–100 characters. Blank inputs rejected.
  - `categoryId`: Required valid UUID referencing an existing category record.
  - `location`: Required, trimmed, 1–150 characters.
  - `capacity`: Optional positive integer (1–100,000). Fractional, negative, zero, non-numeric, or unsafe integers are rejected. Empty inputs are saved as `null` (never zero).
  - `description`: Optional text, trimmed, up to 2,000 characters. Empty inputs saved as `null`.
  - Identity Preservation: Editing a resource preserves its unique ID, `created_at` timestamp, and all existing reservation relationships.

### 3. Deactivation Policy & Row-Locking Concurrency Design
- **Explicit State Transitions**:
  - Activation and deactivation use explicit desired boolean states (`isActive: false` / `isActive: true`), preventing unpredictability from blind toggling.
  - Deactivation requires explicit user confirmation in the interface.
- **Reservation Conflict Protection**:
  - Deactivation is **strictly refused** if any `CONFIRMED` reservation exists with `end_at > NOW()` (including ongoing and upcoming bookings).
  - A descriptive message is returned detailing the conflict and earliest reservation date; bookings are never silently cancelled.
  - Past confirmed reservations (`end_at <= NOW()`) and cancelled reservations (`status = 'CANCELLED'`) do not prevent deactivation.
  - Reactivation preserves full reservation history. Repeated state-setting requests are safe and idempotent.
- **CRITICAL Concurrency Mandate for Future Booking Creation**:
  - Deactivation executes within an interactive PostgreSQL transaction holding an exclusive row lock (`SELECT id, is_active FROM resources WHERE id = $1::uuid FOR UPDATE`).
  - **Shared Lock Requirement**: The future reservation creation transaction **MUST take the exact same row lock** (`SELECT ... FROM resources WHERE id = $1 FOR UPDATE`) before re-checking `is_active` and inserting a new reservation.
  - Without this symmetric row lock on the booking side, a concurrent booking could slip in between the deactivation reservation check and status update. Simply wrapping operations in a transaction does not eliminate this race; row-level locking guarantees mutual exclusion.

---

---

## Reservation Management & Concurrency Architecture

### 1. Booking Policy & Validation Rules
- **Authentication & User Identity**:
  - `userId` is strictly derived from the verified session token on the server (`getCurrentUser()`). Client-submitted or forged user IDs are completely ignored.
  - Active `STAFF` and `ADMIN` users can create reservations for themselves.
  - Inactive accounts or unauthenticated callers are rejected at the server boundary.
- **Resource Constraints**:
  - The requested resource must exist and have `is_active = true`. Deactivated resources cannot be booked.
  - Historical reservations for deactivated resources remain accessible in booking history.
- **Purpose**:
  - Required, trimmed, 1–500 characters. Blank or whitespace-only inputs are rejected.
- **Time Interval & Calendar Validation**:
  - Validates genuine calendar dates (rejects non-existent days like Feb 30 or April 31 without silent JavaScript date rollover).
  - `start_at` must be strictly in the future when processed by the server transaction.
  - `end_at` must be strictly later than `start_at`.
  - Supports arbitrary duration, overnight bookings, and multi-day spans (no arbitrary office-hour limits).
- **Overlap Rules**:
  - `CONFIRMED` reservations for the same resource cannot overlap.
  - Back-to-back contiguous bookings (e.g. 10:00–11:00 and 11:00–12:00) are permitted and supported by `[start, end)` range semantics.
  - Different resources can be booked simultaneously, including by the same user.
  - `CANCELLED` reservations release the reserved slot immediately.

### 2. Timezone Policy (Asia/Colombo, UTC+5:30)
- **Official Office Timezone**: All bookings operate in `Asia/Colombo` time (Sri Lanka Standard Time, fixed UTC+05:30 offset, no daylight saving time).
- **Timezone Determinism**: Datetime inputs (`YYYY-MM-DDTHH:mm`) are parsed using explicit calendar decomposition and converted into UTC Instants via `Date.UTC(...) - 330 minutes`. The resulting instant is completely independent of the server's or browser's host timezone (`process.env.TZ`).
- **Display Standardization**: All displayed timestamps across resource browsing, booking forms, My Reservations, and Admin All Reservations format consistently using `Intl.DateTimeFormat` with `timeZone: "Asia/Colombo"`.

### 3. Creation & Row-Locking Concurrency Architecture
To prevent TOCTOU (Time-of-Check to Time-of-Use) race conditions and eliminate races with resource deactivation, reservation creation runs inside an interactive database transaction:
1. **Acquire Symmetric Resource Row Lock**: Executes `SELECT id, is_active FROM resources WHERE id = $1::uuid FOR UPDATE`. This is the exact same row lock taken by resource deactivation.
2. **Re-verify Active State**: Reads `is_active` after lock acquisition. If an administrator deactivated the resource concurrently, the lock serializes the operations and booking fails with: `"Cannot reserve this resource because it has been deactivated."`
3. **Re-validate Future Start**: Re-verifies `start_at > now()`.
4. **Pre-check Overlaps**: Queries confirmed overlapping bookings to return friendly conflict messages (`"This resource is already reserved for your selected time. Please choose another time or resource."`).
5. **Atomic Insert**: Inserts reservation as `CONFIRMED` with `NULL` cancellation metadata.
6. **PostgreSQL GiST Exclusion Constraint**: The underlying PostgreSQL GiST exclusion constraint (`reservations_no_overlapping_confirmed` with `btree_gist`) acts as the immutable database safeguard. Driver exclusion violations (`23P01`) are mapped to clean conflict messages.

### 4. Cancellation Policy & Deadlock Prevention
- **Authorization**:
  - Reservation owners and administrators can cancel upcoming or in-progress reservations.
  - Unauthorized users cannot cancel or view other employees' reservations.
- **Retroactive Protection**:
  - Finished reservations (`end_at <= now()`) cannot be cancelled retroactively.
- **Reason Requirements**:
  - Administrators cancelling another user's reservation are **required** to supply a nonblank reason.
  - Users cancelling their own reservation may optionally supply a reason.
- **Lock Ordering & Deadlock Risk Reduction**:
  - When locking both the resource and reservation rows during cancellation, operations strictly lock the **resource row first** (`FOR UPDATE`), followed by the **reservation row second** (`FOR UPDATE`). Consistent lock ordering reduces deadlock risk; it does not prove all deadlocks are impossible.
- **Idempotency & Re-entrancy**:
  - Repeated or concurrent cancellation requests return an already-cancelled response without overwriting the original cancellation actor, timestamp, or reason.

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs the Next.js development server with Turbopack |
| `npm run build` | Builds the production application (independent of live database) |
| `npm run start` | Starts the production server |
| `npm run lint` | Runs ESLint style and quality checks |
| `npm run typecheck` | Validates TypeScript types across the codebase |
| `npm test` | Runs the complete automated test suite (db constraints, auth, resources, reservations) |
| `npm run test:db` | Runs isolated database constraint and concurrency tests |
| `npm run test:auth` | Runs isolated authentication, JWT, and authorization tests |
| `npm run test:resources` | Runs isolated resource and category management tests |
| `npm run test:reservations` | Runs isolated reservation lifecycle, timezone, and concurrency tests |
| `npm run create-admin` | CLI command to safely create the initial administrator |
| `npm run prisma:generate` | Generates the Prisma 7 client |
| `npm run prisma:migrate` | Deploys versioned migrations (`prisma migrate deploy`) |

---

## Manual Verification & Demo Checklist

Follow this checklist to test the complete booking and cancellation flow:

1. **Start the Application**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

2. **Sign In as Staff**:
   - Log in with staff credentials.
   - Observe the navigation bar includes **Browse Resources** and **My Reservations**.

3. **Check Live Availability in Browse Resources**:
   - Navigate to `/workspace/resources`.
   - Select a future date and time window (e.g. tomorrow 10:00 AM to 12:00 PM).
   - Click **Apply & Check Availability**.
   - Notice each resource card updates with live availability badges ("Available" or "Reserved for selected time").
   - Click **Reserve** on an available resource card.

4. **Complete a Reservation**:
   - On `/workspace/resources/[id]`, review resource specifications.
   - Verify start and end times default to your selected window (labeled as Asia/Colombo Sri Lanka time).
   - Enter a purpose (e.g., "Engineering Quarterly Review").
   - Click **Confirm & Reserve Resource**.
   - Observe the green confirmation banner detailing the saved reservation and Colombo timestamps.

5. **Verify Conflict Prevention**:
   - Attempt to book the exact same resource for an overlapping time (e.g. tomorrow 11:00 AM to 01:00 PM).
   - Submit the booking.
   - Observe the conflict banner: *"This resource is already reserved for your selected time. Please choose another time or resource."* Notice form inputs are preserved.

6. **Inspect My Reservations**:
   - Navigate to `/workspace/reservations`.
   - Verify your new reservation appears with the **Upcoming** badge, Sri Lanka times, and purpose.
   - Test the filter tabs (**Upcoming**, **In Progress**, **Finished**, **Cancelled**).

7. **Cancel a Reservation**:
   - Click on the reservation card to open `/workspace/reservations/[id]`.
   - Click **Cancel Reservation**.
   - Provide an optional cancellation note and confirm.
   - Observe status updates immediately to **Cancelled**, showing cancellation metadata.
   - Re-check availability for that time window on `/workspace/resources` — verify the slot is immediately released!

8. **Admin Cancellation Oversight**:
   - Sign out and log in as an **Administrator**.
   - Navigate to `/workspace/admin/reservations` (**All Reservations**).
   - Observe all organizational bookings with employee names, email addresses, and status badges.
   - Click **Manage** on a staff booking and test administrative cancellation; observe that a cancellation reason is strictly required.


