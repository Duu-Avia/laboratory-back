import { Router } from "express";
import { getIndicatorsBySampleType } from "../controller/samples/sample.js";
import { getAllIndicators } from "../controller/indicators/get-indicators.js";
import { createIndicator } from "../controller/indicators/create-indicator.js";
import { updateIndicator } from "../controller/indicators/update-indicator.js";
import { deactiveIndicator } from "../controller/indicators/deactive-indicator.js";
import { authMiddleware, checkPermission } from "../middleware/auth-middleware.js";

const indicatorsRouter = Router();

indicatorsRouter.get("/indicators/:id", getIndicatorsBySampleType);
indicatorsRouter.get("/", getAllIndicators);
indicatorsRouter.post("/create-indicator", checkPermission('indicator:manage'), createIndicator);
indicatorsRouter.put("/update/:id", checkPermission('indicator:manage'), updateIndicator);
indicatorsRouter.put("/deactive/:id", checkPermission('indicator:manage'), deactiveIndicator);

export default indicatorsRouter;
