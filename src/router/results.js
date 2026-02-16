import { Router } from "express";
import { saveReportResultsBulk } from "../controller/reports/save-results.js";
import { checkPermission } from "../middleware/auth-middleware.js";

const resultsRouter = Router();

resultsRouter.put("/create-result/:id", checkPermission('result:create'), saveReportResultsBulk);

export default resultsRouter;