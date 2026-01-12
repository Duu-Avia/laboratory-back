import { Router } from "express";
import { createReportWithSamples, getReportDetail, listReports, saveReportResultsBulk } from "../controller/reports.js";
import { report } from "node:process";
import { getReportPdf } from "../controller/generate-pdf.js";

const reportsRouter = Router();

reportsRouter.post("/create", createReportWithSamples);
reportsRouter.get("/", listReports);
reportsRouter.put("/results/:id", saveReportResultsBulk);
reportsRouter.get("/:id", getReportDetail);
reportsRouter.get("/:id/pdf", getReportPdf);
// reportsRouter.put("/approve/:id")


export default reportsRouter;
