import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Consistent environment precedence: existing process variables > .env.local > .env
// dotenv does not override existing variables in process.env
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://placeholder:placeholder@localhost:5432/placeholder?sslmode=disable",
  },
  migrations: {
    path: "prisma/migrations",
  },
});
