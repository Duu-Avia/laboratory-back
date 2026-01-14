import { Router } from "express";
import { createReportWithSamples, getReportDetail, listReports, saveReportResultsBulk, sofDeleteReport, updateReport } from "../controller/reports.js";
import { getReportPdf } from "../controller/generate-pdf.js";

const reportsRouter = Router();

reportsRouter.post("/create", createReportWithSamples); //true
reportsRouter.get("/", listReports); //true
reportsRouter.put("/results/:id", saveReportResultsBulk);
reportsRouter.get("/:id", getReportDetail); //true
reportsRouter.get("/:id/pdf", getReportPdf); //true
reportsRouter.put("/edit/:id", updateReport)
reportsRouter.put("/delete/:id", sofDeleteReport)
// reportsRouter.put("/approve/:id")
export default reportsRouter;
