import { Router } from "express";
import { createReportWithSamples, getReportDetail, listReports, saveReportResultsBulk } from "../controller/reports.js";

const reportsRouter = Router();

reportsRouter.post("/create", createReportWithSamples);
reportsRouter.get("/", listReports);
reportsRouter.get("/:id", getReportDetail);
reportsRouter.put("/:id/results", saveReportResultsBulk);

export default reportsRouter;
