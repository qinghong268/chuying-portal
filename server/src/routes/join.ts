import { Router } from "express";
import { z } from "zod";
import { getDb } from "../connection";

const MAINLAND_MOBILE = /^1[3-9]\d{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidContact(value: string): boolean {
  return MAINLAND_MOBILE.test(value) || EMAIL.test(value);
}

const joinSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  contact: z
    .string()
    .trim()
    .min(1, "Contact is required")
    .max(200)
    .refine(isValidContact, {
      message: "Contact must be a valid mainland China mobile number or email address",
    }),
  message: z.string().trim().min(1, "Message is required").max(2000),
});

export const joinRouter = Router();

joinRouter.post("/", (req, res) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.errors[0]?.message ?? "Invalid request body";
    res.status(400).json({ error: first });
    return;
  }

  const now = Date.now();
  const result = getDb()
    .prepare(
      `INSERT INTO join_applications (name, contact, message, status, created_at)
       VALUES (?, ?, ?, 'pending', ?)`,
    )
    .run(parsed.data.name, parsed.data.contact, parsed.data.message, now);

  res.status(201).json({
    application: {
      id: Number(result.lastInsertRowid),
      name: parsed.data.name,
      contact: parsed.data.contact,
      status: "pending",
      createdAt: now,
    },
  });
});
