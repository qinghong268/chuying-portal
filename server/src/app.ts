import express from "express";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth";
import { contentRouter } from "./routes/content";
import { activitiesRouter } from "./routes/activities";
import { enrollmentsRouter } from "./routes/enrollments";
import { progressRouter } from "./routes/progress";
import { coursesRouter } from "./routes/courses";
import { joinRouter } from "./routes/join";
import { pointAppsRouter } from "./routes/pointApps";
import { pointTemplatesRouter } from "./routes/pointTemplates";
import { adminPointAppsRouter } from "./routes/admin/pointApps";
import { adminPointTypesRouter } from "./routes/admin/pointTypes";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  app.use("/api/content", contentRouter);
  app.use("/api/activities", activitiesRouter);
  app.use("/api/activities", enrollmentsRouter);
  app.use("/api/activities", progressRouter);
  app.use("/api/courses", coursesRouter);
  app.use("/api/join", joinRouter);
  app.use("/api/point-type-templates", pointTemplatesRouter);
  app.use("/api/me", pointAppsRouter);
  app.use("/api/admin/point-applications", adminPointAppsRouter);
  app.use("/api/admin/point-types", adminPointTypesRouter);
  return app;
}
