import { describe, it, expect } from "vitest";
import {
  canApplyActivityReflection,
  isReflectionLengthOk,
} from "../src/domain/eligibility";
import { OFFLINE_APPLY_WINDOW_HOURS } from "@chuying/shared";

const HOUR_MS = 60 * 60 * 1000;
const activityEndAt = 1_000_000;

describe("canApplyActivityReflection", () => {
  it("rejects when not enrolled", () => {
    const result = canApplyActivityReflection({
      enrolled: false,
      mode: "online",
      progressPercent: 100,
      activityEndAt,
      now: activityEndAt,
    });
    expect(result).toEqual({ ok: false, reason: expect.any(String) });
    if (!result.ok) {
      expect(result.reason.toLowerCase()).toContain("enroll");
    }
  });

  describe("online mode", () => {
    it("rejects progress 98.9%", () => {
      const result = canApplyActivityReflection({
        enrolled: true,
        mode: "online",
        progressPercent: 98.9,
        activityEndAt,
        now: activityEndAt,
      });
      expect(result).toEqual({ ok: false, reason: expect.any(String) });
    });

    it("accepts progress 99%", () => {
      const result = canApplyActivityReflection({
        enrolled: true,
        mode: "online",
        progressPercent: 99,
        activityEndAt,
        now: activityEndAt,
      });
      expect(result).toEqual({ ok: true });
    });

    it("rejects after point apply channel closes", () => {
      const result = canApplyActivityReflection({
        enrolled: true,
        mode: "online",
        progressPercent: 99,
        activityEndAt,
        pointApplyDeadline: activityEndAt - 1,
        now: activityEndAt,
      });
      expect(result).toEqual({ ok: false, reason: "point apply channel closed" });
    });
  });

  describe("offline mode", () => {
    const windowMs = OFFLINE_APPLY_WINDOW_HOURS * HOUR_MS;

    it("rejects before activity ends", () => {
      const result = canApplyActivityReflection({
        enrolled: true,
        mode: "offline",
        progressPercent: 0,
        activityEndAt,
        now: activityEndAt - 1,
      });
      expect(result).toEqual({ ok: false, reason: expect.any(String) });
    });

    it("rejects after apply window closes", () => {
      const result = canApplyActivityReflection({
        enrolled: true,
        mode: "offline",
        progressPercent: 0,
        activityEndAt,
        now: activityEndAt + windowMs + 1,
      });
      expect(result).toEqual({ ok: false, reason: expect.any(String) });
    });

    it("accepts at activity end", () => {
      const result = canApplyActivityReflection({
        enrolled: true,
        mode: "offline",
        progressPercent: 0,
        activityEndAt,
        now: activityEndAt,
      });
      expect(result).toEqual({ ok: true });
    });

    it("accepts within 24h window", () => {
      const result = canApplyActivityReflection({
        enrolled: true,
        mode: "offline",
        progressPercent: 0,
        activityEndAt,
        now: activityEndAt + 12 * HOUR_MS,
      });
      expect(result).toEqual({ ok: true });
    });

    it("accepts at window boundary", () => {
      const result = canApplyActivityReflection({
        enrolled: true,
        mode: "offline",
        progressPercent: 0,
        activityEndAt,
        now: activityEndAt + windowMs,
      });
      expect(result).toEqual({ ok: true });
    });
  });
});

describe("isReflectionLengthOk", () => {
  const char = "字";

  it("rejects 299 characters", () => {
    expect(isReflectionLengthOk(char.repeat(299))).toBe(false);
  });

  it("accepts 300 characters", () => {
    expect(isReflectionLengthOk(char.repeat(300))).toBe(true);
  });

  it("accepts 400 characters", () => {
    expect(isReflectionLengthOk(char.repeat(400))).toBe(true);
  });

  it("rejects 401 characters", () => {
    expect(isReflectionLengthOk(char.repeat(401))).toBe(false);
  });
});
