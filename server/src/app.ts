import express from "express";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  return app;
}
