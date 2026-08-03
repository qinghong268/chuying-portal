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
    `INSERT INTO activities (title, description, mode, start_at, end_at, enroll_deadline, point_apply_deadline, target_points, status, featured, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', 1, ?)`,
  );
  const onlineStart = ts + day;
  const onlineEnd = ts + 3 * day;
  insertActivity.run(
    "线上入门讲座",
    "面向雏英的线上入门讲座，完成观看后可提交心得申请积分。",
    "online",
    onlineStart,
    onlineEnd,
    onlineStart,
    onlineEnd + day,
    10,
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
    ts,
  );

  const insertCourse = database.prepare(
    `INSERT INTO courses (title, description, status, featured, created_at)
     VALUES (?, ?, 'published', 1, ?)`,
  );
  insertCourse.run(
    "雏英成长第一课",
    "介绍雏英计划的学习路径与基本要求。",
    ts,
  );
  insertCourse.run(
    "团队协作基础",
    "协作沟通与项目实践的基础课程。",
    ts,
  );
}
