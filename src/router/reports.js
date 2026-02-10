import { Router } from "express";
import { archiveReport, createReportWithSamples, getReportDetail, listReports, saveReportResultsBulk, sofDeleteReport, updateReport } from "../controller/reports/reports.js";
import { approveReport } from "../controller/reports/approve-report.js";
import { rejectReport } from "../controller/reports/reject-report.js";
import { signReport } from "../controller/reports/sign-report.js";
import { getNextReportId } from "../controller/reports/get-id.js";
import { getReportPdf } from "../controller/generate-pdf.js";
import { generateExcel } from "../controller/generate-excel.js";
import { authMiddleware, checkAnyPermission, checkPermission } from "../middleware/auth-middleware.js";

const reportsRouter = Router();

reportsRouter.post("/create", checkPermission("report:create"), createReportWithSamples); //true
reportsRouter.get("/excel", generateExcel)
reportsRouter.get("/",  checkPermission("report:read"), listReports); //true
reportsRouter.get("/archive", checkPermission("report:read"), archiveReport)
reportsRouter.get("/next-id", checkPermission("report:read"), getNextReportId);
reportsRouter.get("/:id",  checkPermission("report:read"), getReportDetail); //true
reportsRouter.get("/:id/pdf", checkPermission("report:read"), getReportPdf); //true
reportsRouter.put("/edit/:id", checkPermission("report:update"), updateReport) //true
reportsRouter.put("/delete/:id", checkPermission("report:delete"), sofDeleteReport) //true
reportsRouter.put("/sign/:id",  signReport)
reportsRouter.put("/approve/:id", checkPermission("report:approve"), approveReport)
reportsRouter.put("/reject/:id", checkPermission("report:approve"), rejectReport)
export default reportsRouter;
