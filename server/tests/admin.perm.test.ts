import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { migrate, seed, getDb } from "../src/db";

beforeAll(() => {
  process.env.DATABASE_PATH = ":memory:";
  process.env.JWT_SECRET = "test-secret-for-admin-perm";
  migrate();
  seed();
});

async function loginAs(
  app: ReturnType<typeof createApp>,
  role: "eagle" | "admin" | "super_admin",
) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/demo-login").send({ role });
  expect(res.status).toBe(200);
  return agent;
}

function adminUserId(): number {
  const row = getDb()
    .prepare(`SELECT id FROM users WHERE email = 'admin@demo'`)
    .get() as { id: number };
  return row.id;
}

describe("admin permission gates", () => {
  it("eagle calling admin API gets 403", async () => {
    const app = createApp();
    const eagle = await loginAs(app, "eagle");

    const res = await eagle.get("/api/admin/content/blocks");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden");
  });

  it("admin without content grant gets 403 on content CMS", async () => {
    const app = createApp();
    const adminId = adminUserId();
    getDb()
      .prepare(
        `DELETE FROM admin_grants WHERE user_id = ? AND permission_code = 'content'`,
      )
      .run(adminId);

    const admin = await loginAs(app, "admin");
    const res = await admin.get("/api/admin/content/blocks");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden");

    // restore for other tests in this file if order changes
    getDb()
      .prepare(
        `INSERT OR IGNORE INTO admin_grants (user_id, permission_code, granted_at)
         VALUES (?, 'content', ?)`,
      )
      .run(adminId, Date.now());
  });

  it("cannot grant permission package to normal admin", async () => {
    const app = createApp();
    const superAdmin = await loginAs(app, "super_admin");
    const adminId = adminUserId();

    const res = await superAdmin
      .put(`/api/admin/admin-grants/${adminId}`)
      .send({ packages: ["content", "permission"] });

    expect(res.status).toBe(400);
    expect(String(res.body.error)).toMatch(/permission/i);

    const grant = getDb()
      .prepare(
        `SELECT 1 AS ok FROM admin_grants
         WHERE user_id = ? AND permission_code = 'permission'`,
      )
      .get(adminId) as { ok: number } | undefined;
    expect(grant).toBeUndefined();
  });
});

describe("admin content CMS smoke", () => {
  it("admin with content can list and publish a block", async () => {
    const app = createApp();
    const admin = await loginAs(app, "admin");

    const listRes = await admin.get("/api/admin/content/blocks");
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.blocks)).toBe(true);
    expect(listRes.body.blocks.length).toBeGreaterThan(0);

    const blockId = listRes.body.blocks[0].id as number;
    expect(listRes.body.blocks[0].status).toBe("published");

    const homeBefore = await request(app).get("/api/content/home");
    const publishedBlock = homeBefore.body.blocks.find(
      (b: { key: string }) => b.key === listRes.body.blocks[0].key,
    );
    expect(publishedBlock).toBeDefined();

    // A02: PUT with status draft must not unpublish live content
    const putRes = await admin.put(`/api/admin/content/blocks/${blockId}`).send({
      title: "更新标题",
      body: "更新正文",
      status: "draft",
    });
    expect(putRes.status).toBe(200);
    expect(putRes.body.block.title).toBe("更新标题");
    expect(putRes.body.block.body).toBe("更新正文");
    expect(putRes.body.block.status).toBe("published");

    const homeAfterDraft = await request(app).get("/api/content/home");
    const liveAfterDraft = homeAfterDraft.body.blocks.find(
      (b: { key: string }) => b.key === listRes.body.blocks[0].key,
    );
    expect(liveAfterDraft.title).toBe(publishedBlock.title);
    expect(liveAfterDraft.body).toBe(publishedBlock.body);

    const pubRes = await admin.post(
      `/api/admin/content/blocks/${blockId}/publish`,
    );
    expect(pubRes.status).toBe(200);
    expect(pubRes.body.block.status).toBe("published");
    expect(pubRes.body.block.title).toBe("更新标题");
    expect(pubRes.body.block.body).toBe("更新正文");

    const homeAfterPublish = await request(app).get("/api/content/home");
    const liveAfterPublish = homeAfterPublish.body.blocks.find(
      (b: { key: string }) => b.key === listRes.body.blocks[0].key,
    );
    expect(liveAfterPublish.title).toBe("更新标题");
    expect(liveAfterPublish.body).toBe("更新正文");
  });

  it("admin can create, edit, sort, publish, and delete content blocks", async () => {
    const app = createApp();
    const admin = await loginAs(app, "admin");

    const createRes = await admin.post("/api/admin/content/blocks").send({
      block_key: "home_partners",
      title: "合作伙伴",
      body: "<p>合作伙伴介绍</p>",
    });
    expect(createRes.status).toBe(201);
    const created = createRes.body.block as {
      id: number;
      key: string;
      status: string;
      sortOrder: number;
    };
    expect(created.key).toBe("home_partners");
    expect(created.status).toBe("draft");
    expect(typeof created.sortOrder).toBe("number");

    // duplicate block_key is rejected
    const dupRes = await admin.post("/api/admin/content/blocks").send({
      block_key: "home_partners",
      title: "重复",
    });
    expect(dupRes.status).toBe(409);

    // extended fields via PUT
    const putRes = await admin.put(`/api/admin/content/blocks/${created.id}`).send({
      coverUrl: "https://example.com/cover.jpg",
      linkUrl: "https://example.com/page",
      linkLabel: "查看详情",
    });
    expect(putRes.status).toBe(200);
    expect(putRes.body.block.coverUrl).toBe("https://example.com/cover.jpg");
    expect(putRes.body.block.linkUrl).toBe("https://example.com/page");
    expect(putRes.body.block.linkLabel).toBe("查看详情");

    const pubRes = await admin.post(
      `/api/admin/content/blocks/${created.id}/publish`,
    );
    expect(pubRes.status).toBe(200);

    // public home exposes the new fields
    const homeRes = await request(app).get("/api/content/home");
    const live = homeRes.body.blocks.find(
      (b: { key: string }) => b.key === "home_partners",
    );
    expect(live).toBeDefined();
    expect(live.coverUrl).toBe("https://example.com/cover.jpg");
    expect(live.linkUrl).toBe("https://example.com/page");
    expect(live.linkLabel).toBe("查看详情");

    // batch sort: renumber to a known sequence, then swap the first two
    const listRes = await admin.get("/api/admin/content/blocks");
    const orders = (
      listRes.body.blocks as { id: number; sortOrder: number }[]
    ).map((b, i) => ({ id: b.id, sort_order: i }));
    const firstId = orders[0].id;
    const secondId = orders[1].id;
    [orders[0].sort_order, orders[1].sort_order] = [
      orders[1].sort_order,
      orders[0].sort_order,
    ];

    const sortRes = await admin.patch("/api/admin/content/blocks/sort").send({
      orders,
    });
    expect(sortRes.status).toBe(200);
    expect(sortRes.body.ok).toBe(true);

    const afterSort = await admin.get("/api/admin/content/blocks");
    const blocks = afterSort.body.blocks as { id: number; sortOrder: number }[];
    expect(blocks[0].id).toBe(secondId);
    expect(blocks[1].id).toBe(firstId);
    expect(blocks[0].sortOrder).toBe(0);
    expect(blocks[1].sortOrder).toBe(1);

    // delete + 404 on re-delete
    const delRes = await admin.delete(
      `/api/admin/content/blocks/${created.id}`,
    );
    expect(delRes.status).toBe(200);
    expect(delRes.body.ok).toBe(true);

    const del404 = await admin.delete(
      `/api/admin/content/blocks/${created.id}`,
    );
    expect(del404.status).toBe(404);

    const finalList = await admin.get("/api/admin/content/blocks");
    expect(
      (finalList.body.blocks as { id: number }[]).some(
        (b) => b.id === created.id,
      ),
    ).toBe(false);
  });
});

describe("admin join review smoke", () => {
  it("approve and reject join applications", async () => {
    const app = createApp();
    const now = Date.now();
    const insert = getDb()
      .prepare(
        `INSERT INTO join_applications (name, contact, message, status, created_at)
         VALUES (?, ?, ?, 'pending', ?)`,
      )
      .run("测试申请人", "t@example.com", "想加入", now);
    const id = Number(insert.lastInsertRowid);

    const admin = await loginAs(app, "admin");
    const listRes = await admin.get("/api/admin/join-applications?status=pending");
    expect(listRes.status).toBe(200);
    expect(listRes.body.applications.some((a: { id: number }) => a.id === id)).toBe(
      true,
    );

    const approveRes = await admin.post(
      `/api/admin/join-applications/${id}/approve`,
    );
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.application.status).toBe("approved");

    const insert2 = getDb()
      .prepare(
        `INSERT INTO join_applications (name, contact, message, status, created_at)
         VALUES (?, ?, ?, 'pending', ?)`,
      )
      .run("驳回申请人", "r@example.com", "想加入", now + 1);
    const id2 = Number(insert2.lastInsertRowid);

    const rejectRes = await admin
      .post(`/api/admin/join-applications/${id2}/reject`)
      .send({ reason: "材料不完整请补充" });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.application.status).toBe("rejected");
  });
});

describe("admin activities + dashboard + users", () => {
  it("CRUD activity and list enrollments; dashboard uses real counts", async () => {
    const app = createApp();
    const admin = await loginAs(app, "admin");
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const createRes = await admin.post("/api/admin/activities").send({
      title: "管理端新建活动",
      description: "描述",
      mode: "online",
      startAt: now + day,
      endAt: now + 3 * day,
      pointApplyDeadline: now + 4 * day,
      targetPoints: 8,
      featured: false,
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.activity.status).toBe("draft");
    expect(createRes.body.activity.enrollDeadline).toBe(now + day);
    const activityId = createRes.body.activity.id as number;

    const pubRes = await admin.post(
      `/api/admin/activities/${activityId}/publish`,
    );
    expect(pubRes.status).toBe(200);
    expect(pubRes.body.activity.status).toBe("published");

    const enrollRes = await admin.get(
      `/api/admin/activities/${activityId}/enrollments`,
    );
    expect(enrollRes.status).toBe(200);
    expect(Array.isArray(enrollRes.body.enrollments)).toBe(true);

    const expectedEagles = (
      getDb()
        .prepare(
          `SELECT COUNT(*) AS c FROM users WHERE role = 'eagle' AND status = 'active'`,
        )
        .get() as { c: number }
    ).c;

    const dashRes = await admin.get("/api/admin/dashboard/summary");
    expect(dashRes.status).toBe(200);
    expect(dashRes.body.eagleCount).toBe(expectedEagles);
    expect(typeof dashRes.body.pendingJoinCount).toBe("number");
    expect(typeof dashRes.body.pendingPointAppCount).toBe("number");
    expect(typeof dashRes.body.activeActivityCount).toBe("number");
    expect(typeof dashRes.body.generatedAt).toBe("number");

    const usersRes = await admin.get("/api/admin/users");
    expect(usersRes.status).toBe(200);
    expect(Array.isArray(usersRes.body.users)).toBe(true);
  });

  it("non-super admin cannot disable a super_admin", async () => {
    const app = createApp();
    const now = Date.now();

    // Ensure ≥2 active supers so last-super guard alone would not block
    getDb()
      .prepare(
        `INSERT INTO users (email, password_hash, role, display_name, status, created_at)
         VALUES (?, 'x', 'super_admin', ?, 'active', ?)`,
      )
      .run(`super-extra-${now}@demo`, "额外超级管理员", now);

    const superRow = getDb()
      .prepare(`SELECT id FROM users WHERE email = 'super@demo'`)
      .get() as { id: number };

    const admin = await loginAs(app, "admin");
    const res = await admin.post(`/api/admin/users/${superRow.id}/disable`);
    expect(res.status).toBe(403);
    expect(String(res.body.error)).toMatch(/super admin/i);

    const stillActive = getDb()
      .prepare(`SELECT status FROM users WHERE id = ?`)
      .get(superRow.id) as { status: string };
    expect(stillActive.status).toBe("active");
  });
});
