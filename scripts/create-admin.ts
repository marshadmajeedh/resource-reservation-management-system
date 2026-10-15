import "dotenv/config";
import { Client } from "pg";
import * as readline from "node:readline";
import { normalizeEmail } from "../src/features/auth/types.ts";
import { hashPassword } from "../src/features/auth/password.ts";

/**
 * Initial Administrator Creation CLI Command.
 *
 * Security Mandates:
 * 1. Passwords are never accepted via command-line arguments (process.argv)
 *    to prevent credential exposure in process lists (ps/top) and shell histories.
 * 2. Passwords are obtained via hidden interactive input or a protected local
 *    environment variable (ADMIN_PASSWORD).
 * 3. Never prints passwords or password hashes.
 * 4. Never hardcodes a default password.
 * 5. Refuses to overwrite existing accounts, reset passwords, or silently promote users.
 * 6. Validates email format and password strength (minimum 8 characters).
 * 7. Strictly invoked explicitly; never executed in automated CI/build/migrations.
 */

// Refuse passwords passed as CLI arguments
for (const arg of process.argv.slice(2)) {
  if (
    arg.startsWith("--password") ||
    arg.startsWith("-p") ||
    arg.startsWith("password=")
  ) {
    console.error(
      "\n[SECURITY ERROR] Passing passwords via command-line arguments is strictly prohibited."
    );
    console.error(
      "Arguments are visible in operating system process listings and shell history."
    );
    console.error(
      "Please run the command interactively or provide the ADMIN_PASSWORD environment variable.\n"
    );
    process.exit(1);
  }
}

function promptVisible(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      // Non-interactive fallback: read standard line if stdin was piped
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
      return;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    process.stdout.write(question);
    let password = "";

    process.stdin.setRawMode(true);
    process.stdin.resume();

    const onData = (chunk: Buffer) => {
      const str = chunk.toString();
      for (const ch of str) {
        if (ch === "\r" || ch === "\n") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener("data", onData);
          rl.close();
          process.stdout.write("\n");
          resolve(password);
          return;
        } else if (ch === "\u0003") {
          // SIGINT Ctrl+C
          process.stdout.write("\n");
          process.exit(1);
        } else if (ch === "\u0008" || ch === "\x7f") {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else {
          password += ch;
          process.stdout.write("*");
        }
      }
    };

    process.stdin.on("data", onData);
  });
}

async function main() {
  console.log("==================================================");
  console.log(" Resource Reservation System - Initial Admin Setup");
  console.log("==================================================");

  let databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim() === "") {
    if (process.env.POSTGRES_USER && process.env.POSTGRES_PASSWORD && process.env.POSTGRES_DB) {
      const u = encodeURIComponent(process.env.POSTGRES_USER);
      const p = encodeURIComponent(process.env.POSTGRES_PASSWORD);
      const h = process.env.POSTGRES_HOST || "db";
      const port = process.env.POSTGRES_PORT || "5432";
      const d = encodeURIComponent(process.env.POSTGRES_DB);
      databaseUrl = `postgresql://${u}:${p}@${h}:${port}/${d}?sslmode=disable`;
      process.env.DATABASE_URL = databaseUrl;
    } else {
      console.error("\n[ERROR] DATABASE_URL is not set in environment or .env file.\n");
      process.exit(1);
    }
  }

  let adminName = process.env.ADMIN_NAME?.trim() || "";
  let adminEmail = process.env.ADMIN_EMAIL?.trim() || "";
  let adminPassword = process.env.ADMIN_PASSWORD || "";

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    if (!adminName) {
      adminName = await promptVisible(rl, "Enter Administrator Name: ");
    }
    if (!adminEmail) {
      adminEmail = await promptVisible(rl, "Enter Administrator Email: ");
    }
  } finally {
    rl.close();
  }

  if (!adminName) {
    console.error("\n[ERROR] Administrator Name is required.\n");
    process.exit(1);
  }

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!adminEmail || !EMAIL_REGEX.test(adminEmail) || adminEmail.length > 255) {
    console.error("\n[ERROR] A valid email address (max 255 characters) is required.\n");
    process.exit(1);
  }

  if (!adminPassword) {
    adminPassword = await promptHidden("Enter Administrator Password (input hidden): ");
  }

  if (!adminPassword || adminPassword.length < 8) {
    console.error("\n[ERROR] Administrator password must be at least 8 characters long.\n");
    process.exit(1);
  }

  if (adminPassword.length > 128) {
    console.error("\n[ERROR] Administrator password must not exceed 128 characters.\n");
    process.exit(1);
  }

  const normalizedEmail = normalizeEmail(adminEmail);

  // Connect to database to verify existence and insert
  const client = new Client({
    connectionString: databaseUrl,
    ssl:
      databaseUrl.includes("localhost") ||
      databaseUrl.includes("127.0.0.1") ||
      databaseUrl.includes("sslmode=disable") ||
      process.env.DATABASE_SSL === "false"
        ? false
        : { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    // Check if account with email already exists
    const existingCheck = await client.query(
      `SELECT id, role, is_active FROM users WHERE email = $1`,
      [normalizedEmail]
    );

    if (existingCheck.rows.length > 0) {
      console.error(
        `\n[SECURITY REFUSAL] An account with email '${normalizedEmail}' already exists (Current Role: ${existingCheck.rows[0].role}).`
      );
      console.error(
        "Refusing to overwrite existing account, reset credentials, or silently promote it.\n"
      );
      process.exit(1);
    }

    console.log("Generating secure Argon2id password hash...");
    const passwordHash = await hashPassword(adminPassword);

    const insertResult = await client.query(
      `INSERT INTO users (id, name, email, password_hash, role, is_active, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'ADMIN', true, NOW())
       RETURNING id, name, email, role, is_active AS "isActive"`,
      [adminName, normalizedEmail, passwordHash]
    );

    const createdAdmin = insertResult.rows[0];

    console.log("\n==================================================");
    console.log(" Initial Administrator Created Successfully");
    console.log("==================================================");
    console.log(` User ID:   ${createdAdmin.id}`);
    console.log(` Name:      ${createdAdmin.name}`);
    console.log(` Email:     ${createdAdmin.email}`);
    console.log(` Role:      ${createdAdmin.role}`);
    console.log(` Active:    ${createdAdmin.isActive}`);
    console.log("==================================================\n");
  } catch (err: unknown) {
    console.error("\n[DATABASE ERROR] Failed to create administrator account.");
    if (err instanceof Error) {
      console.error(err.message);
    }
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error("Unexpected failure:", err);
  process.exit(1);
});
