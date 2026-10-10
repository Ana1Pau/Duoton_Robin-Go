// Katerbot — picks the repository implementation.
import type { Repo } from "./repo";
import { memoryRepo } from "./memory";

let repo: Repo | null = null;

export async function getRepo(): Promise<Repo> {
  if (repo) return repo;
  if (process.env.SQLSERVER_CONNECTION_STRING) {
    const { mssqlRepo } = await import("./mssql");
    repo = mssqlRepo;
  } else {
    repo = memoryRepo;
  }
  return repo;
}

export function dbMode(): "sqlserver" | "memory" {
  return process.env.SQLSERVER_CONNECTION_STRING ? "sqlserver" : "memory";
}
