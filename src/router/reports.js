import {Router} from "express";
import { getReport } from "../controller/get-report.js";
import { createReport } from "../controller/create-report.js";
import { getReports } from "../controller/get-reports.js";

const reportsRouter = Router();

reportsRouter.get("/list", getReports);
reportsRouter.post("/create", createReport);
reportsRouter.get("/list", getReports);
reportsRouter.get("/:reportId", getReport);

export default reportsRouter;