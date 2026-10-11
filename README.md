# Resource Reservation Management System

A technical assessment project implementing an internal office Resource Reservation Management System for managing and booking office resources (meeting rooms, desks, equipment) with role-based access and strict conflict prevention.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router with Turbopack)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict mode)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Database**: PostgreSQL hosted on Supabase (Session Pooler)
- **Package Manager**: `npm` (tracked with `package-lock.json`)

## Architecture & Folder Structure

The project follows a lightweight, feature-oriented modular architecture without unnecessary microservices or heavy abstractions:

```text
├── src/
│   ├── app/                    # Next.js App Router routes, layouts, and pages (server entry points)
│   │   ├── layout.tsx          # Root layout and metadata
│   │   ├── page.tsx            # Home page ("Resource Reservation Management")
│   │   └── globals.css         # Styling and design system tokens
│   ├── features/               # Feature domains
│   │   ├── auth/               # User authentication, role types (Admin / Staff), session contracts
│   │   ├── resources/          # Office resource domain types and inputs
│   │   └── reservations/       # Booking time slots, status handling, conflict rules
│   └── lib/                    # Shared utilities and database client configuration
│       ├── db.ts               # Database configuration helper
│       └── utils.ts            # Formatting and helper utilities
├── .env.example                # Tracked environment variable template (DATABASE_URL, JWT_SECRET)
├── .gitignore                  # Git ignore rules (protects local .env files)
├── package.json                # Project dependencies and npm scripts
└── tsconfig.json               # TypeScript compiler configuration
```

### Layer Separation Principles

- **UI Presentation**: Next.js App Router pages and reusable React components.
- **Server Entry Points**: App Router pages and Server Actions / API routes.
- **Business Logic**: Pure domain validation (such as conflict detection and role verification) inside feature services.
- **Database Access**: Direct SQL / PostgreSQL queries isolated from UI layers.

## Getting Started

### Prerequisites

- **Node.js**: v20.x or higher
- **npm**: v10.x or higher

### 1. Installation

Clone the repository and install dependencies using `npm`:

```bash
npm install
```

### 2. Configure Environment Variables

Create a local environment file from the provided `.env.example`:

```bash
cp .env.example .env.local
```

Open `.env.local` and populate your variables:
- `DATABASE_URL`: Your Supabase PostgreSQL Session Pooler connection string.
- `JWT_SECRET`: A secure random secret string for session signing.

> Note: `.env.local` is ignored by Git to protect your credentials.

### 3. Local Development

Start the local development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs the Next.js development server with Turbopack |
| `npm run build` | Validates TypeScript and creates an optimized production build |
| `npm run start` | Starts the production server |
| `npm run lint` | Runs ESLint code style checks |
