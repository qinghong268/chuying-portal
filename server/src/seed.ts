import {
  PERMISSION_PACKAGES,
  POINT_TEMPLATE_CODES,
  type PermissionCode,
} from "@chuying/shared";
import { getDb } from "./connection";
import { hashPassword } from "./lib/password";

const DEMO_PASSWORD = "Demo1234!";

const TEMPLATE_NAMES: Record<(typeof POINT_TEMPLATE_CODES)[number], string> = {
  contest_award: "比赛获奖",
  speech: "分享宣讲",
  project_contrib: "项目贡献",
  honor: "荣誉表彰",
  other_special: "其他专项",
};

const TEMPLATE_DEFAULT_POINTS: Record<(typeof POINT_TEMPLATE_CODES)[number], number> = {
  contest_award: 50,
  speech: 30,
  project_contrib: 40,
  honor: 60,
  other_special: 20,
};

function now(): number {
  return Date.now();
}

function insertUser(
  email: string,
  role: "eagle" | "admin" | "super_admin",
  displayName: string,
): number {
  const result = getDb()
    .prepare(
      `INSERT INTO users (email, password_hash, role, display_name, status, created_at)
       VALUES (?, ?, ?, ?, 'active', ?)`,
    )
    .run(email, hashPassword(DEMO_PASSWORD), role, displayName, now());
  return Number(result.lastInsertRowid);
}

function grantPermissions(userId: number, codes: readonly PermissionCode[]): void {
  const stmt = getDb().prepare(
    `INSERT INTO admin_grants (user_id, permission_code, granted_at) VALUES (?, ?, ?)`,
  );
  const ts = now();
  for (const code of codes) {
    stmt.run(userId, code, ts);
  }
}

export function runSeed(): void {
  const database = getDb();
  const userCount = database.prepare("SELECT COUNT(*) AS c FROM users").get() as {
    c: number;
  };
  if (userCount.c > 0) {
    return;
  }

  insertUser("eagle@demo", "eagle", "演示雏英");
  const adminId = insertUser("admin@demo", "admin", "演示管理员");
  const superAdminId = insertUser("super@demo", "super_admin", "演示超级管理员");

  grantPermissions(
    superAdminId,
    PERMISSION_PACKAGES as readonly PermissionCode[],
  );
  grantPermissions(
    adminId,
    PERMISSION_PACKAGES.filter((code) => code !== "permission") as PermissionCode[],
  );

  const ts = now();
  const insertTemplate = database.prepare(
    `INSERT INTO point_type_templates (code, name, default_points, enabled, allow_applicant_edit_points, created_at)
     VALUES (?, ?, ?, 1, 0, ?)`,
  );
  for (const code of POINT_TEMPLATE_CODES) {
    insertTemplate.run(code, TEMPLATE_NAMES[code], TEMPLATE_DEFAULT_POINTS[code], ts);
  }

  const insertBlock = database.prepare(
    `INSERT INTO content_blocks (block_key, title, body, draft_title, draft_body, status, updated_at)
     VALUES (?, ?, ?, ?, ?, 'published', ?)`,
  );
  insertBlock.run(
    "home_hero",
    "雏英计划",
    "欢迎了解 SoftTong 雏英计划。计划详情与宣传素材由运营团队后续补充。",
    "雏英计划",
    "欢迎了解 SoftTong 雏英计划。计划详情与宣传素材由运营团队后续补充。",
    ts,
  );
  insertBlock.run(
    "home_plan_promo",
    "雏英计划宣传",
    "雏英计划面向青年人才，提供学习、实践与成长机会。具体方案与细则以正式发布为准。",
    "雏英计划宣传",
    "雏英计划面向青年人才，提供学习、实践与成长机会。具体方案与细则以正式发布为准。",
    ts,
  );
  insertBlock.run(
    "home_company_promo",
    "软通智慧",
    "软通智慧致力于数字化与智能化解决方案。公司介绍与案例素材由运营团队后续补充。",
    "软通智慧",
    "软通智慧致力于数字化与智能化解决方案。公司介绍与案例素材由运营团队后续补充。",
    ts,
  );

  const day = 24 * 60 * 60 * 1000;
  const insertActivity = database.prepare(
    `INSERT INTO activities (title, description, mode, start_at, end_at, enroll_deadline, point_apply_deadline, target_points, video_url, image_url, status, featured, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 1, ?)`,
  );
  const onlineStart = ts + day;
  const onlineEnd = ts + 3 * day;
  insertActivity.run(
    "线上入门讲座",
    "面向雏英的线上入门讲座，活动结束后 24 小时内可提交心得申请积分。",
    "online",
    onlineStart,
    onlineEnd,
    onlineStart,
    onlineEnd + day,
    10,
    "https://example.com/videos/intro-online-lecture.mp4",
    null,
    ts,
  );
  const offlineStart = ts + 7 * day;
  const offlineEnd = ts + 7 * day + 4 * 60 * 60 * 1000;
  insertActivity.run(
    "线下实践工作坊",
    "线下集中实践工作坊，活动结束后可在规定窗口内提交心得。",
    "offline",
    offlineStart,
    offlineEnd,
    offlineStart,
    offlineEnd + day,
    15,
    null,
    "https://example.com/images/offline-workshop.jpg",
    ts,
  );

  const insertCourse = database.prepare(
    `INSERT INTO courses (title, description, video_url, cover_url, status, featured, sort_order, created_at)
     VALUES (?, ?, ?, ?, 'published', 1, ?, ?)`,
  );
  insertCourse.run(
    "雏英成长第一课",
    "介绍雏英计划的学习路径与基本要求。",
    "https://example.com/videos/course-01.mp4",
    "https://example.com/covers/course-01.jpg",
    0,
    ts,
  );
  insertCourse.run(
    "团队协作基础",
    "协作沟通与项目实践的基础课程。",
    "https://example.com/videos/course-02.mp4",
    "https://example.com/covers/course-02.jpg",
    1,
    ts,
  );

  seedDemoData();
}

/**
 * Demo-only records to make a fresh install immediately demo-ready:
 * ended activities (24h apply window), demo enrollments, pending
 * reflections/applications, and a pending join application.
 * Only runs on a freshly seeded database (guarded by the caller).
 */
function seedDemoData(): void {
  const db = getDb();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const eagleId = 1; // eagle@demo

  // 1. Create 2 ended activities (ended 1-2 days ago, within 24h apply window)
  const endedActivity1 = db.prepare(
    `INSERT INTO activities (title, description, mode, start_at, end_at, enroll_deadline, point_apply_deadline, target_points, status, featured, created_at)
     VALUES (?, ?, 'offline', ?, ?, ?, ?, ?, 'published', 1, ?)`,
  ).run(
    "往期线下实践", "已结束的线下实践活动，用于演示心得申请24h窗口。",
    now - 3 * day, now - day, now - 3 * day, now + day, 20, now,
  );

  const endedActivity2 = db.prepare(
    `INSERT INTO activities (title, description, mode, start_at, end_at, enroll_deadline, point_apply_deadline, target_points, status, featured, created_at)
     VALUES (?, ?, 'online', ?, ?, ?, ?, ?, 'published', 0, ?)`,
  ).run(
    "线上技术分享会", "已结束的线上技术分享，用于演示线上活动心得申请。",
    now - 2 * day, now - day / 2, now - 2 * day, now + day, 15, now,
  );

  const actId1 = Number(endedActivity1.lastInsertRowid);
  const actId2 = Number(endedActivity2.lastInsertRowid);

  // 2. Enroll eagle in both ended activities
  db.prepare(
    `INSERT INTO enrollments (user_id, activity_id, status, enrolled_at) VALUES (?, ?, 'enrolled', ?)`,
  ).run(eagleId, actId1, now - 2 * day);
  db.prepare(
    `INSERT INTO enrollments (user_id, activity_id, status, enrolled_at) VALUES (?, ?, 'enrolled', ?)`,
  ).run(eagleId, actId2, now - day);

  // 3. Create a pending type1 reflection for the first ended activity
  const reflection =
    "通过参加往期线下实践，我对雏英计划的实践培养模式有了切身体会。活动内容涵盖了团队协作、项目管理和技术实践三大模块，让我在实践中快速提升了综合能力。特别是与导师和其他雏英的深入交流，让我对自己未来的职业发展方向有了更清晰的认知。这次实践经历让我深刻理解到理论知识与实际操作相结合的重要性，也坚定了我继续参与雏英计划各项活动的决心。期待在未来的活动中获得更多成长。";
  db.prepare(
    `INSERT INTO point_applications (user_id, type, activity_id, course_id, template_code, payload, status, points_requested, created_at)
     VALUES (?, 'type1', ?, NULL, NULL, ?, 'pending', ?, ?)`,
  ).run(eagleId, actId1, JSON.stringify({ reflection }), 20, now);

  // 4. Create a pending type2 application
  db.prepare(
    `INSERT INTO point_applications (user_id, type, activity_id, course_id, template_code, payload, status, points_requested, created_at)
     VALUES (?, 'type2', NULL, NULL, 'contest_award', ?, 'pending', ?, ?)`,
  ).run(
    eagleId,
    JSON.stringify({
      title: "全国算法竞赛二等奖",
      reason:
        "代表公司参加全国大学生算法竞赛并获得二等奖，展示了扎实的算法功底和解决复杂问题的能力。",
    }),
    50,
    now,
  );

  // 5. Create a pending join application
  db.prepare(
    `INSERT INTO join_applications (name, contact, message, status, created_at)
     VALUES (?, ?, ?, 'pending', ?)`,
  ).run(
    "演示申请人",
    "demo-applicant@example.com",
    "我对雏英计划非常感兴趣，希望加入这个充满活力的团队，与公司共同成长。",
    now,
  );

  // 6. Add AI reviews for the pending type1 app (so dashboard shows AI risk badges)
  const type1AppId = db
    .prepare(
      "SELECT id FROM point_applications WHERE user_id = ? AND type = 'type1' AND status = 'pending' ORDER BY id DESC LIMIT 1",
    )
    .get(eagleId) as { id: number };
  if (type1AppId) {
    db.prepare(
      `INSERT INTO ai_reviews (application_id, score, relevance, suggestion, recommended_action, suggested_points, draft_reject_reason, created_at)
       VALUES (?, 7, 8, '心得内容完整，结合实践经历，语言流畅。建议通过并授予目标积分。', 'approve', 20, '', ?)`,
    ).run(type1AppId.id, now);
  }
}
