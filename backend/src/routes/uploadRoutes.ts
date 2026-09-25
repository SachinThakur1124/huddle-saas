import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole, WorkspaceScopedRequest } from "../middleware/requireRole";
import { validateObjectIdParams } from "../middleware/validateObjectId";
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

/**
 * @openapi
 * /workspaces/{workspaceId}/uploads:
 *   post:
 *     summary: Upload a file (png/jpeg/gif/pdf, 5MB max) as a workspace attachment
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       201: { description: "{ id, url, mimeType, size } — url is an authenticated download route, not a public path" }
 *       400: { description: Unsupported file type, oversized, or missing file }
 */
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
      // Authenticated download route, not a static file path — anyone
      // with this URL still needs a valid token AND membership in the
      // workspace the attachment belongs to (see the GET handler below).
      url: `/workspaces/${req.params.workspaceId}/uploads/${attachment._id}`,
      mimeType: attachment.mimeType,
      size: attachment.size,
    });
  });
});

/**
 * @openapi
 * /workspaces/{workspaceId}/uploads/{attachmentId}:
 *   get:
 *     summary: Download an attachment (requires auth + membership in the workspace it belongs to)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: workspaceId, in: path, required: true, schema: { type: string } }
 *       - { name: attachmentId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: File contents }
 *       404: { description: Attachment not found (or belongs to another workspace) }
 */
uploadRoutes.get(
  "/:attachmentId",
  validateObjectIdParams("attachmentId"),
  async (req: WorkspaceScopedRequest, res) => {
    const attachment = await Attachment.findOne({
      _id: req.params.attachmentId,
      workspaceId: req.params.workspaceId,
    });
    if (!attachment) return res.status(404).json({ error: "Attachment not found" });

    res.type(attachment.mimeType);
    res.sendFile(path.resolve(attachment.path));
  },
);
