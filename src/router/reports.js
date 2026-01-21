import { Router } from "express";
import { createReportWithSamples, getReportDetail, listReports, saveReportResultsBulk, sofDeleteReport, updateReport } from "../controller/reports.js";
import { getReportPdf } from "../controller/generate-pdf.js";
import { generateExcel } from "../controller/generate-excel.js";

const reportsRouter = Router();

reportsRouter.post("/create", createReportWithSamples); //true
reportsRouter.get("/excel", generateExcel)
reportsRouter.get("/", listReports); //true
reportsRouter.put("/results/:id", saveReportResultsBulk);
reportsRouter.get("/:id", getReportDetail); //true
reportsRouter.get("/:id/pdf", getReportPdf); //true
reportsRouter.put("/edit/:id", updateReport) //true
reportsRouter.put("/delete/:id", sofDeleteReport) //true
// reportsRouter.put("/approve/:id")
export default reportsRouter;
