import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "./connection";

export function migrate(): void {
  const sql = readFileSync(join(__dirname, "migrate.sql"), "utf8");
  getDb().exec(sql);
}
