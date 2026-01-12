import express from "express";
import { getConnection } from "./config/connection-db.js";
import sampleRouter from "./router/indicators.js";
import cors from "cors";
import reportsRouter from "./router/reports.js";
import sampleTypeRouter from "./router/sample-types.js";
const app = express();


app.use(cors());
const corsOptions = {
  origin: ['http://localhost:3000','http://localhost:8000']
};
app.use(cors(corsOptions))


const PORT = process.env.PORT || 8000;


app.use(express.json());

// Routes
app.use("/sample", sampleRouter);
app.use("/reports", reportsRouter);
app.use("/sample-types", sampleTypeRouter)


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