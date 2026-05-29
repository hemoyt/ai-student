import fs from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.SUPABASE_DATABASE_URL;

if (!connectionString) {
  console.error(
    "DATABASE_URL, POSTGRES_URL, SUPABASE_DB_URL, or SUPABASE_DATABASE_URL is required to apply the schema."
  );
  process.exit(1);
}

const databaseUrl = connectionString;

const rootDir = process.cwd();
const schemaPath = path.join(rootDir, "supabase", "schema.sql");
const seedPath = path.join(rootDir, "supabase", "seed.sql");

async function main() {
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl:
      databaseUrl.includes("localhost") ||
      databaseUrl.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    const schemaSql = await fs.readFile(schemaPath, "utf8");
    const seedSql = await fs.readFile(seedPath, "utf8");

    console.log("Applying Supabase schema...");
    await client.query(schemaSql);

    console.log("Applying seed data...");
    await client.query(seedSql);

    console.log("Database setup complete.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
