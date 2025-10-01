import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import uploadRouter from "./routes/upload.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const BASE_PATH = process.env.BASE_PATH || "";
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(BASE_PATH, express.static(path.join(__dirname, "../public")));

// Routes
app.use(`${BASE_PATH}/upload`, uploadRouter);

app.get('/', (req, res) => {
  res.redirect(BASE_PATH);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});