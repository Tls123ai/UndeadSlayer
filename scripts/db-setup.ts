import { config } from "dotenv";
import { getDatabaseConnection, closeDatabase } from "../src/db";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function main() {
  try {
    const connection = await getDatabaseConnection();
    console.log(`Database ready (${connection.kind}). All migrations applied.`);
  } finally {
    await closeDatabase();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Database setup failed.");
  process.exitCode = 1;
});
