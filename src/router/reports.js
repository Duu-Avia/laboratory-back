import { Router } from "express";
import { archiveReport, createReportWithSamples, getReportDetail, listReports, saveReportResultsBulk, sofDeleteReport, updateReport } from "../controller/reports.js";
import { getReportPdf } from "../controller/generate-pdf.js";
import { generateExcel } from "../controller/generate-excel.js";
import { authMiddleware, checkAnyPermission, checkPermission } from "../middleware/auth-middleware.js";

const reportsRouter = Router();

reportsRouter.post("/create", createReportWithSamples); //true
reportsRouter.get("/excel", generateExcel)
reportsRouter.get("/", authMiddleware, checkPermission("report:read"), listReports); //true
reportsRouter.get("/archive", authMiddleware, checkPermission("report:read"), archiveReport)
reportsRouter.put("/results/:id", saveReportResultsBulk);
reportsRouter.get("/:id", authMiddleware, checkPermission("report:read"), getReportDetail); //true
reportsRouter.get("/:id/pdf", authMiddleware, checkPermission("report:read"), getReportPdf); //true
reportsRouter.put("/edit/:id",authMiddleware, checkPermission("report:update"), updateReport) //true
reportsRouter.put("/delete/:id",authMiddleware, checkPermission("report:delete"), sofDeleteReport) //true
// reportsRouter.put("/approve/:id")
export default reportsRouter;
