import express from "express";
import dotenv from "dotenv";
import { getConnection } from "./config/connection-db.js";
import sampleRouter from "./router/sample.js";
import reportsRouter from "./router/reports.js";
import cors from "cors";
const app = express();


app.use(cors());
const corsOptions = {
  origin: ['http://localhost:3000','http://localhost:8000']
};
app.use(cors(corsOptions))

dotenv.config();


const PORT = process.env.PORT || 8000;


app.use(express.json());

// Routes
app.use("/api/sample", sampleRouter);
app.use("/api/report", reportsRouter);

app.get("/", (req, res) => {
  res.send("Laboratory API is running");
});

async function startServer() {
  try {
    await getConnection();
    console.log("✅ Database connected!");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.log("❌ Database connection failed", error);
  }
}

startServer();