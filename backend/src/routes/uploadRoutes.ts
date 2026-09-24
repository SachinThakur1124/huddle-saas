import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole, WorkspaceScopedRequest } from "../middleware/requireRole";
import { Attachment } from "../models/Attachment";

export const uploadRoutes = Router({ mergeParams: true });

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/gif", "application/pdf"]);
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error("Unsupported file type"));
    }
    cb(null, true);
  },
});

uploadRoutes.use(requireAuth, requireRole("member"));

uploadRoutes.post("/", (req: WorkspaceScopedRequest, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    const attachment = await Attachment.create({
      workspaceId: req.params.workspaceId,
      uploaderId: req.userId,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
    });

    res.status(201).json({
      id: attachment._id,
      url: `/uploads/${path.basename(req.file.path)}`,
      mimeType: attachment.mimeType,
      size: attachment.size,
    });
  });
});
