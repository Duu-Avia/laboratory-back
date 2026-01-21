import { Router } from "express";
import { getIndicatorsBySampleType } from "../controller/sample.js";
import { getAllIndicators } from "../controller/get-indicators.js";
import { createIndicator } from "../controller/create-indicator.js";

const indicatorsRouter = Router();

indicatorsRouter.get("/indicators/:id", getIndicatorsBySampleType);
indicatorsRouter.get("/", getAllIndicators);
indicatorsRouter.post("/create-indicator",createIndicator)

export default indicatorsRouter;
