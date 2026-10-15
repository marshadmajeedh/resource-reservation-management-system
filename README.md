# Resource Reservation Management System

A production-grade, internal office Resource Reservation Management System built for managing and booking office resources (meeting rooms, workstations, conference suites, and equipment) with strict role-based access control, real-time database session verification, and PostgreSQL-enforced concurrency and conflict prevention.

---

## Table of Contents

- [Business Problem & Purpose](#business-problem--purpose)
- [Implemented Features](#implemented-features)
- [Tech Stack & Supported Runtime](#tech-stack--supported-runtime)
- [Entity Relationship (ER) Diagram](#entity-relationship-er-diagram)
- [Demo Video](#demo-video)
- [Architecture Overview](#architecture-overview)
- [Database Overlap Protection & Concurrency Design](#database-overlap-protection--concurrency-design)
- [Business Policies](#business-policies)
  - [Booking Policy](#1-booking-policy)
  - [Timezone Policy (Asia/Colombo, UTC+05:30)](#2-timezone-policy-asiacolombo-utc0530)
  - [Cancellation & Audit Policy](#3-cancellation--audit-policy)
  - [Resource Deactivation Policy](#4-resource-deactivation-policy)
  - [Staff Deactivation Policy](#5-staff-deactivation-policy)
- [Known Architectural Limitations & Honest Disclosures](#known-architectural-limitations--honest-disclosures)
- [Docker Quick Start (Local Production Evaluation)](#docker-quick-start-local-production-evaluation)
- [Getting Started (Native Node + Supabase Setup)](#getting-started-native-node--supabase-setup)
  - [Prerequisites](#prerequisites)
  - [1. Installation](#1-installation)
  - [2. Environment Configuration](#2-environment-configuration)
  - [3. Database Setup (Local PostgreSQL or Supabase)](#3-database-setup-local-postgresql-or-supabase)
  - [4. Prisma Migrations and Client Generation](#4-prisma-migrations-and-client-generation)
  - [5. Initial Administrator Setup CLI](#5-initial-administrator-setup-cli)
  - [6. Running the Application](#6-running-the-application)
- [Automated Testing](#automated-testing)
- [Available Scripts](#available-scripts)
- [Manual Verification & Assessment Checklist](#manual-verification--assessment-checklist)

---

## Business Problem & Purpose

Modern office environments struggle with resource contention, overlapping bookings (double-bookings), lack of visibility into available physical assets, and role ambiguity:
- **Contention & Double-Bookings**: When two team members reserve the same room simultaneously, naive reservation systems that rely solely on application-level checks suffer from race conditions (Time-of-Check to Time-of-Use / TOCTOU), resulting in duplicate bookings and meeting disruptions.
- **Audit & Cancellation Accountability**: Ad-hoc cancellations without audit trails lead to unaccountable asset scheduling, lost reservations, and scheduling confusion.
- **Role Isolation**: Non-administrative staff require seamless self-service reservation browsing and management without having unauthorized access to resource provisioning, categorization, or employee directory controls.
- **Deactivation Races**: Deactivating a room or an employee while reservations are pending can cause orphaned bookings or inconsistent schedules if not synchronized atomically.

This system provides a unified, hardened internal management portal where:
1. Administrative staff manage categories, physical resources, and staff accounts.
2. Active employees browse real-time availability and reserve resources.
3. PostgreSQL GiST exclusion constraints (`btree_gist`) mathematically prevent overlapping confirmed bookings at the storage engine level.
4. Symmetric row-level locking serializes resource deactivations and reservation creations, eliminating TOCTOU race conditions.
5. Real-time database verification on every request ensures instant access revocation when accounts are deactivated or roles change.

---

## Implemented Features

### 1. Authentication & Role-Based Access Control
- **Dual Role Architecture**: `ADMIN` and `STAFF` roles with strict server-side authorization boundaries.
- **Argon2id Password Security**: Passwords hashed with OWASP-recommended parameters (`@node-rs/argon2`).
- **Timing Disparity Reduction**: Constant-time dummy verification executed for non-existent/inactive accounts to mitigate user enumeration timing attacks.
- **Stateless Minimal JWT**: Signed with `HS256` (`jose`), containing only user ID (`sub`). No roles or sensitive data stored in token payloads.
- **HttpOnly Session Cookies**: Hardened cookie configuration (`HttpOnly`, `SameSite=Lax`, `Path=/`, 8-hour lifetime, `Secure` in production).
- **Real-Time Verification (`dal.ts`)**: Database role and active status checked on every request; role changes and account deactivations take effect immediately without waiting for token expiration.
- **In-Memory Rate Limiting**: Keyed on normalized email (max 5 failed attempts within 15-minute window).
- **CSRF & Redirect Protection**: Strict Origin/Referer mutation checks and relative path sanitization.

### 2. Resource & Category Management (Admin)
- **Hierarchical Categorization**: Create and rename categories with trimmed unique names.
- **Resource Specifications**: Resource name, category reference, location, optional positive integer capacity, and optional description.
- **Referential Integrity**: Categories and resources enforce `ON DELETE RESTRICT` foreign keys; historical reservations are never cascade-deleted.
- **Safe Activation Lifecycle**: Resources can be activated or deactivated explicitly. Deactivation is strictly blocked if any upcoming or ongoing confirmed reservations exist.
- **Live Search & Filtering**: Paginated browsing with case-insensitive search, category filtering, and status filtering.

### 3. Staff Account Management (Admin)
- **Employee Provisioning**: Administrators provision staff accounts with full name, email, and initial password. Role is strictly locked to `STAFF` server-side.
- **Email Normalization**: System-wide lowercase trimming prevents duplicate or casing-bypass accounts.
- **Display Name Editing**: Administrators can edit staff display names (email addresses remain immutable).
- **Immediate Access Revocation**: Deactivating a staff account sets `isActive = false`, revoking existing JWT sessions on their very next HTTP request.
- **Reservation Retention**: Staff deactivation never deletes or alters historical or confirmed bookings; audit trails remain fully intact.
- **Role Isolation**: Admin accounts cannot be viewed, edited, or deactivated through the staff interface.

### 4. Reservation Lifecycle & Concurrency (Staff & Admin)
- **Sri Lanka Office Timezone**: All bookings operate in `Asia/Colombo` (UTC+05:30, fixed offset, no DST) with deterministic calendar decomposition.
- **Live Availability Badges**: Browse resources with selected time windows; cards update in real time with "Available" or "Reserved for selected time".
- **Strict Overlap Prevention**: Confirmed reservations for the same resource cannot overlap.
- **Contiguous Back-to-Back Bookings**: Supported through PostgreSQL `[start, end)` half-open interval semantics (e.g., 10:00–11:00 and 11:00–12:00 succeed without conflict).
- **Released Slot Re-booking**: Cancelling a reservation releases the time slot immediately for new bookings.
- **Cancellation Controls**: Staff can cancel their own upcoming bookings; administrators can cancel any booking but are strictly required to provide a cancellation reason. Finished bookings cannot be cancelled retroactively.

---

## Tech Stack & Supported Runtime

| Component | Technology | Version / Specification |
| :--- | :--- | :--- |
| **Framework** | Next.js (App Router, Turbopack, Server Actions) | `16.4.0` |
| **Language** | TypeScript (Strict Mode) | `^5.0.0` |
| **UI Library** | React | `19.3.0` |
| **Styling** | Tailwind CSS | `v4` |
| **ORM** | Prisma Client with `@prisma/adapter-pg` driver adapter | `^7.10.0` |
| **Database** | PostgreSQL with `btree_gist` extension | `16` or `17` (Local or Hosted Supabase) |
| **Cryptography** | `@node-rs/argon2`, `jose` | Argon2id & JWT HS256 |
| **Runtime** | Node.js (Active LTS) | `>=24.0.0` (Tracked via `.node-version` & `.nvmrc`) |
| **Package Manager** | npm | Tracked via `package-lock.json` |

---

## Entity Relationship (ER) Diagram

![Entity Relationship (ER) Diagram](internTechnicalAssesmentERD.drawio.png)

- **Draw.io ER Diagram Link:** [https://drive.google.com/file/d/1f_SflD2tCAHyPCCUMpl5mSYOQto9s3oc/view?usp=sharing](https://drive.google.com/file/d/1f_SflD2tCAHyPCCUMpl5mSYOQto9s3oc/view?usp=sharing)

### Final ER Diagram Specification & Design Notes

The production system implements a strict four-entity relational schema with zero redundant tables or denormalized availability columns:

#### 1. `users` (`User`)
- `id`: `UUID` (PK, default `gen_random_uuid()`)
- `name`: `TEXT` (NOT NULL, 1–100 chars)
- `email`: `TEXT` (UQ, NOT NULL, normalized lowercase)
- `password_hash`: `TEXT` (NOT NULL, internal Argon2id hash)
- `role`: `UserRole` enum (`ADMIN`, `STAFF`, default `STAFF`)
- `is_active`: `BOOLEAN` (NOT NULL, default `true`)
- `created_at`: `TIMESTAMPTZ(6)` (NOT NULL, default `CURRENT_TIMESTAMP`)
- **Relations**:
  - `reservations`: 1-to-many `Reservation` (`userId`, named `"UserReservations"`, `ON DELETE RESTRICT`)
  - `cancelledReservations`: 1-to-many `Reservation` (`cancelledById`, named `"CancelledReservations"`, `ON DELETE RESTRICT`, optional)

#### 2. `resource_categories` (`ResourceCategory`)
- `id`: `UUID` (PK, default `gen_random_uuid()`)
- `name`: `TEXT` (UQ, NOT NULL, 1–100 chars)
- **Relations**:
  - `resources`: 1-to-many `Resource` (`categoryId`, `ON DELETE RESTRICT`)

#### 3. `resources` (`Resource`)
- `id`: `UUID` (PK, default `gen_random_uuid()`)
- `category_id`: `UUID` (FK -> `resource_categories.id`, NOT NULL, `ON DELETE RESTRICT`)
- `name`: `TEXT` (NOT NULL, 1–100 chars)
- `description`: `TEXT` (NULLABLE, up to 2000 chars)
- `location`: `TEXT` (NOT NULL, 1–150 chars)
- `capacity`: `INTEGER` (NULLABLE, `CHECK ("capacity" IS NULL OR "capacity" > 0)`)
- `is_active`: `BOOLEAN` (NOT NULL, default `true`)
- `created_at`: `TIMESTAMPTZ(6)` (NOT NULL, default `CURRENT_TIMESTAMP`)
- **Relations**:
  - `category`: Many-to-1 `ResourceCategory` (`categoryId`)
  - `reservations`: 1-to-many `Reservation` (`resourceId`, `ON DELETE RESTRICT`)

#### 4. `reservations` (`Reservation`)
- `id`: `UUID` (PK, default `gen_random_uuid()`)
- `user_id`: `UUID` (FK -> `users.id`, NOT NULL, `ON DELETE RESTRICT`)
- `resource_id`: `UUID` (FK -> `resources.id`, NOT NULL, `ON DELETE RESTRICT`)
- `purpose`: `TEXT` (NOT NULL, 1–500 chars)
- `start_at`: `TIMESTAMPTZ(6)` (NOT NULL)
- `end_at`: `TIMESTAMPTZ(6)` (NOT NULL)
- `status`: `ReservationStatus` enum (`CONFIRMED`, `CANCELLED`, default `CONFIRMED`)
- `created_at`: `TIMESTAMPTZ(6)` (NOT NULL, default `CURRENT_TIMESTAMP`)
- `cancelled_at`: `TIMESTAMPTZ(6)` (NULLABLE)
- `cancelled_by_id`: `UUID` (FK -> `users.id`, NULLABLE, `ON DELETE RESTRICT`)
- `cancellation_reason`: `TEXT` (NULLABLE)
- **Database Constraints**:
  - Timing check: `CHECK ("end_at" > "start_at")`
  - Cancellation consistency check:
    ```sql
    CHECK (
      ("status" = 'CONFIRMED' AND "cancelled_at" IS NULL AND "cancelled_by_id" IS NULL AND "cancellation_reason" IS NULL)
      OR
      ("status" = 'CANCELLED' AND "cancelled_at" IS NOT NULL AND "cancelled_by_id" IS NOT NULL)
    )
    ```
  - GiST exclusion constraint (`btree_gist`):
    ```sql
    EXCLUDE USING gist (
      "resource_id" WITH =,
      tstzrange("start_at", "end_at", '[)') WITH &&
    ) WHERE ("status" = 'CONFIRMED')
    ```

---

## Demo Video

<!-- Place demonstration video link below for assessment submission -->
[Demo Video: https://youtu.be/xnkcGNWUjJc]

---

## Architecture Overview

The system follows a modular, feature-based architecture separating domain logic, data access, presentation, and security boundaries:

```
src/
├── app/                              # Next.js App Router (Routes, Layouts, Server Pages)
│   ├── api/auth/                     # REST API endpoints (login, logout, me, admin-check)
│   ├── login/                        # Authentication UI
│   └── workspace/                    # Protected application shell
│       ├── admin/                    # Admin-only consoles (categories, resources, staff, all reservations)
│       ├── reservations/             # Employee self-service reservations (My Reservations & Details)
│       └── resources/                # Employee resource directory & live booking UI
├── components/                       # Shared UI components (Navigation, Layouts)
├── features/                         # Domain-driven feature modules
│   ├── auth/                         # Password hashing, JWT signing, cookies, CSRF, rate-limiting, DAL
│   ├── reservations/                 # Booking lifecycle, conflict checks, cancellation, repository
│   ├── resources/                    # Resource & category administration, validation, repository
│   └── staff/                        # Staff provisioning, name edits, deactivation, repository
├── generated/prisma/                 # Prisma 7 generated client code
└── lib/                              # Cross-cutting utilities (db client, Asia/Colombo timezone parser)
```

### Three-Tier Pattern per Feature
Each feature module (`auth`, `resources`, `reservations`, `staff`) implements strict separation:
1. `service.ts`: Enforces business rules, input validation, role checks, and domain logic.
2. `repository.ts`: Encapsulates all direct database queries, Prisma operations, and PostgreSQL transactions.
3. `actions.ts`: Exposes Next.js Server Actions with CSRF origin validation, real-time caller authorization, and cache revalidation.

---

## Database Overlap Protection & Concurrency Design

### The Problem: TOCTOU Race Conditions
In high-concurrency environments, checking for conflicting bookings via `SELECT COUNT(*) WHERE ...` before inserting creates a Time-of-Check to Time-of-Use (TOCTOU) race condition. If two requests execute the check concurrently, both see zero conflicts and proceed to insert, resulting in duplicate bookings. Traditional B-Tree unique indexes cannot resolve this because they only detect identical `(start_at, end_at)` intervals, failing to catch partial overlaps (e.g., 10:00–12:00 vs. 11:00–13:00).

### The Solution: PostgreSQL GiST Exclusion Constraint
The database implements a native GiST (Generalized Search Tree) exclusion constraint using PostgreSQL's `btree_gist` extension:

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

- **Half-Open Intervals `[)`**: The `[start_at, end_at)` range includes the start instant and excludes the end instant. Contiguous back-to-back bookings (e.g., 10:00–11:00 and 11:00–12:00) share an exact boundary without overlapping, enabling consecutive scheduling without artificial buffer gaps.
- **Partial Index Filter `WHERE ("status" = 'CONFIRMED')`**: Cancelled reservations are automatically excluded from the exclusion index. When a reservation is cancelled, its time slot is immediately released for new confirmed bookings without altering historical records.
- **Atomic Engine-Level Enforcement**: Concurrent inserts or updates violating this constraint are rejected atomically by PostgreSQL with error code `23P01` (`exclusion_violation`).

### Symmetric Row-Level Locking
To prevent race conditions between resource deactivation and reservation creation:
- **Resource Deactivation**: Holds an exclusive row lock (`SELECT id, is_active FROM resources WHERE id = $1::uuid FOR UPDATE`) inside an interactive transaction before verifying active reservations and updating status.
- **Reservation Creation**: Acquires the **exact same row lock** (`SELECT id, is_active FROM resources WHERE id = $1 FOR UPDATE`) inside its booking transaction before re-verifying active status and inserting the booking.
- **Guaranteed Mutual Exclusion**: This symmetric locking serializes competing operations, preventing a booking from slipping in while a resource is being deactivated.

---

## Business Policies

### 1. Booking Policy
- **Authentication**: Caller identity is strictly extracted from verified session cookies (`getCurrentUser()`). Client-supplied user IDs are completely ignored.
- **Resource Eligibility**: Only resources with `isActive = true` can be reserved.
- **Timing**: Datetimes must represent valid calendar days. Start time must be strictly in the future (`startAt > NOW()`), and end time must be strictly later than start time (`endAt > startAt`).
- **Concurrent Independence**: Different resources can be booked simultaneously, including by the same user.

### 2. Timezone Policy (Asia/Colombo, UTC+05:30)
- **Official Office Timezone**: All bookings operate in Sri Lanka Standard Time (`Asia/Colombo`, fixed UTC+05:30 offset, no daylight saving time).
- **Host Independence**: Datetime inputs (`YYYY-MM-DDTHH:mm`) are decomposed into calendar components and converted directly into UTC Instants via `Date.UTC(...) - 330 minutes`. The calculation produces identical UTC values regardless of the server's or client's local system timezone (`process.env.TZ`).
- **Standardized Display**: All interfaces format timestamps using `Intl.DateTimeFormat` configured with `timeZone: "Asia/Colombo"`.

### 3. Cancellation & Audit Policy
- **Authorization**: Staff may only cancel their own upcoming or in-progress reservations. Administrators can cancel any reservation.
- **Reason Mandate**: Administrators cancelling another employee's booking are **strictly required** to supply a nonblank cancellation reason. Staff cancelling their own booking may optionally supply a note.
- **Retroactive Protection**: Finished reservations (`endAt <= NOW()`) cannot be cancelled retroactively.
- **Immutability & Idempotency**: Repeated or concurrent cancellation requests return an already-cancelled response without overwriting the original cancellation actor, timestamp, or reason.

### 4. Resource Deactivation Policy
- **Conflict Safeguard**: Deactivation is **strictly refused** if any `CONFIRMED` reservation exists with `endAt > NOW()` (including ongoing and future bookings).
- **Descriptive Guidance**: Deactivation rejection returns a descriptive message detailing the conflict and earliest booking date; bookings are never silently cancelled.
- **Reactivation**: Reactivating a resource restores self-service availability immediately while preserving complete historical records.

### 5. Staff Deactivation Policy
- **Immediate Access Revocation**: Setting `isActive = false` in the database revokes access on the employee's very next request because `getCurrentUser()` verifies active database status in real time.
- **History Preservation**: Deactivation does not delete or cancel the staff member's bookings; reservations remain intact for audit and organizational visibility.
- **Confirmation Awareness**: The administrative deactivation modal displays the member's upcoming booking count and provides a direct management link.

---

## Known Architectural Limitations & Honest Disclosures

### 1. In-Memory Login Rate Limiter
- **Scope**: Tracks failed login attempts in application process memory.
- **Process Restarts**: Attempt counts reset to zero when the Node.js application process restarts.
- **Clustering**: In-memory attempt counts are not shared across multi-instance clusters (a centralized store such as Redis would be required for distributed deployments).
- **Email-Based Keying**: Rate limiting keys on normalized email rather than client IP to thwart credential-stuffing without relying on spoofable forwarding headers (`X-Forwarded-For`).
- **Lockout Trade-Off**: Submitting 5 invalid password attempts for a specific email triggers a 15-minute temporary lockout window for that email address.

### 2. Stateless JWT Logout Limitation
- **Cookie Clearing**: Signing out clears the `rrs_session` HttpOnly cookie by setting `Max-Age=0`.
- **Stateless Validity**: Because this implementation uses stateless JWTs without a distributed token revocation table or token blacklist, a previously intercepted token remains cryptographically valid until its 8-hour expiration.
- **Database Mitigations**: Account deactivation in the database revokes access immediately on all subsequent requests because the server validates active status on every request.

### 3. Staff Credential Distribution
- **No Self-Service Reset**: Self-service password reset and staff password changes are not implemented in this scope.
- **Manual Communication**: Initial staff credentials generated by administrators must be communicated through an appropriate, secure private channel. Initial passwords do not expire automatically.

---

## Docker Quick Start (Local Production Evaluation)

Reviewers can clone the repository, configure local environment variables, and run the Next.js application and PostgreSQL in an isolated Docker container stack using Docker Compose.

### Docker Prerequisites
- **Docker Engine** (or **Docker Desktop**) with Docker Compose v2.20+ installed and running.
- Port `3000` available on localhost (or customize `APP_PORT` in `.env.docker`).

---

### Step 1: Environment File Setup
Copy the tracked Docker environment example to create your local `.env.docker`:

```bash
cp .env.docker.example .env.docker
```

> **Security & Isolation Architecture**:
> - `.env.docker` is gitignored and kept strictly separate from the host `.env` file (which is used for native Node + Supabase workflows).
> - Docker Compose explicitly reads `.env.docker`. This ensures an existing Supabase `DATABASE_URL` in `.env` is never inadvertently used by container migrations.
> - Passwords containing special characters (e.g. `@`, `:`, `#`, `%`, `/`) are automatically URL-encoded by the container entrypoint when constructing the PostgreSQL connection URI.

---

### Step 2: Generate a JWT Secret Key
Generate a secure 32+ character secret for `JWT_SECRET` in `.env.docker`:

**Using OpenSSL (Host):**
```bash
openssl rand -base64 32
```

**Without Host Dependencies (Using Docker):**
```bash
docker run --rm node:24-bookworm-slim node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Paste the generated string into `JWT_SECRET` inside `.env.docker`.

---

### Step 3: Build & Start Services
Build the images and start the PostgreSQL database, migration runner, and Next.js web application:

```bash
docker compose --env-file .env.docker up --build -d
```

#### Startup & Service Sequencing:
1. **`db`** (`postgres:17-alpine`): Initializes PostgreSQL 17 on the internal Docker network with persistent storage (`rrs_pgdata` volume) and runs health checks via `pg_isready`.
2. **`migrate`** (`node:24-bookworm-slim`): Waits for `db` to become healthy, runs `npx prisma migrate deploy` to apply tracked schema migrations, and exits with code 0 on success.
3. **`app`** (`node:24-bookworm-slim`): Starts only after migrations complete successfully (`service_completed_successfully`). Serves the production Next.js build on `0.0.0.0:3000` bound to host loopback `127.0.0.1:3000`.

---

### Step 4: Create the Initial Administrator
Run the interactive administrator setup CLI inside the running application container:

```bash
docker compose --env-file .env.docker exec -it app npm run create-admin
```

*(Alternatively, if running one-off before starting the app service:*
`docker compose --env-file .env.docker run --rm -it app npm run create-admin`*)*

**Interactive Prompts:**
- **Administrator Name**: e.g., `System Admin`
- **Administrator Email**: e.g., `admin@reserve.local`
- **Administrator Password**: Masked input with `*` (minimum 8 characters, Argon2id hashed)

---

### Step 5: Access the Web Application
Open your browser and navigate to:
**[http://localhost:3000](http://localhost:3000)** (or `http://127.0.0.1:3000`)

1. Log in with your administrator credentials.
2. Navigate to the Admin Workspace to create Resource Categories, Physical Resources, and Staff Accounts.
3. Log out and log in with a Staff account to verify booking and reservation lifecycles.

> **Local HTTP Cookie Limitation & Security Notice**:
> - Setting `COOKIE_SECURE=false` in `.env.docker` explicitly disables Secure cookies to permit local evaluation over unencrypted HTTP (`http://localhost:3000`).
> - The documented Compose setup is restricted by its host loopback binding (`127.0.0.1:${APP_PORT:-3000}:3000`), mitigating exposure over external network interfaces during local review.
> - Deployed production environments served over HTTPS/TLS must retain Secure cookies (`Secure=true`) by setting `COOKIE_SECURE=true` or omitting the variable entirely.
> - Cookie defense-in-depth flags (`HttpOnly=true`, `SameSite=lax`, `Path=/`, and Server Action origin validation) provide layered mitigation, but `HttpOnly` and `SameSite` alone do not eliminate all classes of XSS or CSRF threats without end-to-end transport encryption (HTTPS) in production.

---

### Step 6: Viewing Logs
Inspect real-time logs from all or individual services:

```bash
# View combined logs from all services:
docker compose --env-file .env.docker logs -f

# View logs from a specific service:
docker compose --env-file .env.docker logs -f app
docker compose --env-file .env.docker logs -f migrate
docker compose --env-file .env.docker logs -f db
```

---

### Step 7: Stopping & Restarting Services
To gracefully stop the containers without losing data:

```bash
docker compose --env-file .env.docker down
```

To restart the application:
```bash
docker compose --env-file .env.docker up -d
```

---

### Data Persistence & Safe Operations
- All database state (users, categories, resources, reservations, and audit logs) is stored in the named Docker volume `rrs_pgdata`.
- Normal `docker compose down` and container restarts preserve all data.
- **Destructive Warning**: Running `docker compose down -v` permanently removes the named volume and erases all database records. Never use `-v` unless you intentionally want a clean slate wipe.

---

### Troubleshooting

#### Port 3000 Conflict
If port 3000 is already in use by another service on your machine:
1. Open `.env.docker` and change `APP_PORT`:
   ```env
   APP_PORT=3001
   ```
2. Restart Compose:
   ```bash
   docker compose --env-file .env.docker up -d
   ```
3. Access the application at [http://localhost:3001](http://localhost:3001).

#### Migration Service Exits Nonzero
If the `migrate` service fails:
1. Check the logs: `docker compose --env-file .env.docker logs migrate`
2. Verify that `POSTGRES_USER` and `POSTGRES_PASSWORD` in `.env.docker` match the database credentials.
3. Verify that the database is healthy: `docker compose --env-file .env.docker ps`

---

## Getting Started (Native Node + Supabase Setup)

### Prerequisites

- **Node.js**: `v24.x` (Active LTS) — verified via `.node-version` / `.nvmrc`
- **npm**: `v10.x` or `v11.x`
- **PostgreSQL**: `v16` or `v17` (Local installation or hosted Supabase)

---

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd resource-reservation-management-system
npm install
```

*Note: `npm install` automatically triggers `postinstall: prisma generate` to generate the Prisma 7 client.*

---

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Open `.env` and configure the three required variables:

```env
# Primary application database connection (PostgreSQL / Supabase Session Pooler)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rrs_db?sslmode=disable"

# Isolated test database connection (strictly required for automated test suite)
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rrs_test?sslmode=disable"

# Secret key for JWT signing (minimum 32 characters)
JWT_SECRET="generate-a-secure-random-jwt-secret-placeholder"
```

#### Generating a Secure JWT Secret
Run the following command to generate a cryptographically secure 48-byte base64 secret for `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Copy the generated string and paste it into `JWT_SECRET` in your `.env` file.

---

### 3. Database Setup (Local PostgreSQL or Supabase)

#### Option A: Local PostgreSQL Setup (Recommended for Local Evaluation)
If using a local PostgreSQL installation, create the application database and the isolated test database:

```bash
# Using PostgreSQL command-line utility:
createdb -U postgres rrs_db
createdb -U postgres rrs_test
```

Or execute via `psql`:

```sql
CREATE DATABASE rrs_db;
CREATE DATABASE rrs_test;
```

Update your `.env` accordingly:
```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/rrs_db?sslmode=disable"
TEST_DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/rrs_test?sslmode=disable"
```

#### Option B: Hosted Supabase Configuration (Optional)
If connecting to a hosted Supabase PostgreSQL project:
1. Obtain the **Session Pooler** connection string from your Supabase dashboard (Settings -> Database -> Connection Pooling, Port 5432 or 6543).
2. Set `DATABASE_URL` in `.env`:
   ```env
   DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?sslmode=require"
   ```
3. Keep `TEST_DATABASE_URL` pointing to your local disposable `rrs_test` instance (automated tests strictly refuse to run against remote databases).

---

### 4. Prisma Migrations and Client Generation

Generate the Prisma Client:
```bash
npm run prisma:generate
```

Deploy the versioned database migration (applies tables, enums, `btree_gist` extension, check constraints, and GiST exclusion constraints):
```bash
npm run prisma:migrate
```

---

### 5. Initial Administrator Setup CLI

Create the initial administrator account using our secure setup command:

```bash
npm run create-admin
```

**Security Design**:
- You will be prompted interactively for **Administrator Name**, **Email**, and **Password**. Passwords are masked with `*` and hidden in the terminal.
- Passwords are never accepted via CLI flags (`--password`) to prevent credential leakage into process tables and shell history.
- In automated/scripted environments, credentials can be supplied via environment variables:
  ```bash
  ADMIN_NAME="System Administrator" ADMIN_EMAIL="admin@reserve.local" ADMIN_PASSWORD="AdminSecurePassword123!" npm run create-admin
  ```
- Re-running the command against an existing account is strictly refused to prevent credential overwrites.

---

### 6. Running the Application

#### Development Mode (with Turbopack)
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

#### Production Build & Start
```bash
npm run build
npm run start
```
Starts the optimized production server on [http://localhost:3000](http://localhost:3000).

---

## Automated Testing

The automated test suite runs against an isolated, disposable PostgreSQL database:

### Test Safety Mandates
1. `TEST_DATABASE_URL` is strictly mandatory and never falls back to `DATABASE_URL`.
2. Host must be on the local allowlist (`localhost`, `127.0.0.1`, `::1`, `postgres`).
3. Database name must strictly equal `rrs_test`.
4. Tests perform targeted, foreign-key-safe cleanup of test-generated fixtures without table-wide `TRUNCATE` or `DELETE`.

### Running Tests

```bash
# Run all automated test suites:
npm test

# Or run individual feature suites:
npm run test:db            # Database constraint & concurrency test suite
npm run test:auth          # Authentication, JWT, and authorization test suite
npm run test:resources     # Resource and category management test suite
npm run test:reservations  # Reservation lifecycle, timezone, and concurrency tests
npm run test:staff         # Staff-account management and security tests
```

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Next.js development server with Turbopack |
| `npm run build` | Builds optimized production bundle |
| `npm run start` | Starts Next.js production server |
| `npm run lint` | Runs ESLint code style and quality validation |
| `npm run typecheck` | Validates TypeScript types across the entire project |
| `npm test` | Runs the complete automated test suite (all 5 test suites) |
| `npm run test:db` | Runs database constraint and GiST exclusion tests |
| `npm run test:auth` | Runs authentication, JWT, and authorization tests |
| `npm run test:resources` | Runs resource and category management tests |
| `npm run test:reservations` | Runs reservation lifecycle and conflict prevention tests |
| `npm run test:staff` | Runs staff-account management and security tests |
| `npm run create-admin` | Secure CLI tool to create the initial administrator |
| `npm run prisma:generate` | Generates Prisma 7 client files |
| `npm run prisma:migrate` | Deploys versioned Prisma migrations to target database |

---

## Manual Verification & Assessment Checklist

Follow this checklist to evaluate the complete booking, cancellation, and staff management flows:

### 1. Administrator Setup & Category Management
- [ ] Navigate to `/login` and sign in with administrator credentials (`admin@reserve.local`).
- [ ] Verify successful redirection to `/workspace` showing the `Admin` role badge.
- [ ] Navigate to `/workspace/admin/categories` and create a category (e.g., `Conference Rooms`).
- [ ] Verify the category appears in the list and can be renamed.

### 2. Resource Management
- [ ] Navigate to `/workspace/admin/resources/new`.
- [ ] Create a resource: `Boardroom Alpha`, Category `Conference Rooms`, Location `Building A, 3rd Floor`, Capacity `12`.
- [ ] Verify the resource appears in `/workspace/admin/resources`.

### 3. Staff Account Management
- [ ] Navigate to `/workspace/admin/staff` and click **Add Staff Member**.
- [ ] Create an account: Name `Alice Staff`, Email `alice@reserve.local`, Password `StaffPass1234!`.
- [ ] Verify Alice Staff appears in the table with role `STAFF` and status `Active`.
- [ ] Test editing display name to `Alice Smith` and confirm update.

### 4. Staff Login & Resource Browsing
- [ ] Sign out from the administrator account.
- [ ] Sign in as `alice@reserve.local` with `StaffPass1234!`.
- [ ] Verify redirection to `/workspace` showing the `Staff` role badge.
- [ ] Navigate to `/workspace/resources` and verify `Boardroom Alpha` is listed.

### 5. Role Isolation
- [ ] While signed in as staff, attempt to navigate to `/workspace/admin`.
- [ ] Verify that staff is denied access and redirected to `/workspace`.
- [ ] Attempt to call `/api/auth/admin-check` and verify `403 Forbidden` response.

### 6. Reservation Creation & Colombo Timezone
- [ ] Select a time window (e.g., tomorrow 10:00 to 11:00 AM) and verify the Sri Lanka time (`Asia/Colombo`) label.
- [ ] Submit reservation with purpose `Quarterly Planning Review`.
- [ ] Verify green confirmation banner and booking appearance in `/workspace/reservations`.

### 7. Overlap Conflict Prevention
- [ ] Attempt to book the same resource for an overlapping interval (e.g., tomorrow 10:30 to 11:30 AM).
- [ ] Verify booking is rejected with conflict banner: *"This resource is already reserved for your selected time. Please choose another time or resource."*

### 8. Back-to-Back Scheduling
- [ ] Book the exact contiguous time slot (tomorrow 11:00 AM to 12:00 PM).
- [ ] Verify back-to-back booking succeeds without conflict due to `[start, end)` range semantics.

### 9. Cancellation & Released Time Slot Re-booking
- [ ] Open `/workspace/reservations/[id]` for the 10:00–11:00 booking and click **Cancel Reservation**.
- [ ] Verify reservation status updates to `Cancelled`.
- [ ] Immediately re-book 10:00 to 11:00 AM for the same resource; verify the released slot is immediately bookable.

### 10. Staff Deactivation & Instant Session Revocation
- [ ] In another browser window (or after signing in as Administrator), navigate to `/workspace/admin/staff`.
- [ ] Click **Deactivate** on Alice Smith; review the confirmation modal detailing active bookings.
- [ ] Confirm deactivation.
- [ ] In Alice's browser session, refresh or attempt an action; verify immediate access revocation (redirected to `/login`).
- [ ] Attempt to log in with Alice's credentials; verify rejection with generic error: *"Invalid email or password."*

### 11. Reservation History Preservation
- [ ] Sign in as Administrator and open `/workspace/admin/reservations`.
- [ ] Verify that all reservations previously booked by Alice remain intact, auditable, and visible in organizational booking records.
