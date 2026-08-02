import { describe, it, expect, beforeAll } from "vitest";
import { migrate, seed, getDb } from "../src/db";

beforeAll(() => {
  process.env.DATABASE_PATH = ":memory:";
  migrate();
  seed();
});

it("seeds three demo users with roles", () => {
  const rows = getDb()
    .prepare("SELECT role FROM users ORDER BY role")
    .all() as { role: string }[];
  expect(rows.map((r) => r.role).sort()).toEqual([
    "admin",
    "eagle",
    "super_admin",
  ]);
});
