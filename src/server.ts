import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import uploadRouter from "./routes/upload.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static(path.join(__dirname, "../public")));

// Routes
app.use("/upload", uploadRouter);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});