import { Router } from "express";
import multer from "multer";
import { extname, join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { requireAuth, requireRole } from "../middleware/auth";

const UPLOADS_DIR = join(__dirname, "..", "..", "public", "uploads");

// Ensure directory exists
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + extname(file.originalname));
  },
});

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/svg+xml",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image and video files are allowed"));
    }
  },
});

export const uploadRouter = Router();

// Require admin auth for upload
uploadRouter.use(requireAuth, requireRole("admin", "super_admin"));

// POST /api/admin/upload - single file upload
uploadRouter.post("/", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({ error: "文件大小不能超过 100MB" });
          return;
        }
      }
      res.status(400).json({ error: err.message || "上传失败" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "请选择文件" });
      return;
    }
    const url = `/uploads/${req.file.filename}`;
    res.status(201).json({ url, filename: req.file.filename });
  });
});
