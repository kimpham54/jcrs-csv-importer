// src/routes/upload.ts
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { parseCsvAndInsert } from "../../utils/csvHandler.js";

const router = Router();
const uploadDir = process.env.UPLOAD_DIR || "public/uploads";
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});

function csvOnly(_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const ok =
    file.mimetype === "text/csv" ||
    file.mimetype === "application/vnd.ms-excel" ||
    file.originalname.toLowerCase().endsWith(".csv");
    if (ok) {
    cb(null, true);
  } else {
    cb(new Error("Only CSV files are allowed"));
  }
}

const upload = multer({ storage, fileFilter: csvOnly });

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const filePath = path.resolve(req.file.path);
    // This will: parse CSV -> insert -> then (inside csvHandler) backfill handles
    // uses .env DB_TABLE if set
    const result = await parseCsvAndInsert(filePath);
    const message = `Successfully processed ${result.inserted || 0} rows from ${req.file.originalname}`;
    console.log(message);

    res.status(200).json({
      ok: true,
      message: message,
      file: req.file.originalname,
      storedAs: req.file.filename,
      ...result, // { rows, inserted }
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message || "Failed to process CSV" });
  }
});

export default router;
