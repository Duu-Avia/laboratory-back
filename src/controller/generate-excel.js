import ExcelJS from "exceljs";
import { getConnection } from "../config/connection-db.js";
import sql from "mssql"

export async function generateExcel(req,res){
    const status = req.query.status ?? "all";
    const type = req.query.type ?? "all";
    const search = req.query.search ?? "";
    console.log(status, type, search)
    try{
        const pool = await getConnection()
        const response = await pool.request()
        .input('status', sql.NVarChar(50), status)
        // .input('type', sql.NVarChar(50), type)
        // .input('search', sql.NVarChar(100), search)
        .query(`
            SELECT 
            r.id,
            r.report_title,
            r.created_at,
            r.status,
            s.sample_name,
            s.sampled_by,
            i.indicator_name,
            st.type_name
            FROM reports r
            JOIN samples s ON s.report_id = r.id
            JOIN sample_types st ON st.id = s.sample_type_id
            JOIN indicators i ON i.id = i.sample_type_id
            JOIN sample_indicators si ON si.sample_id = s.id
            WHERE (r.status = @status OR r.status != 'deleted')
            ORDER BY r.created_at DESC;
            `)
            const rows = response.recordset
            const wb = new exceljs.Workbook();
            const ws = new exceljs.addWorksheet("Reports");
                ws.columns = [
      { header: "Он сар", key: "created_at", width: 14 },
      { header: "Дугаар", key: "id", width: 10 },
      { header: "Дээжны нэр", key: "report_title", width: 30 },
      { header: "Оруулсан дээжүүд", key: "sample_names", width: 40 },
      { header: "Байршил", key: "location", width: 25 },
      { header: "Лаб төрөл", key: "type_name", width: 16 },
      { header: "Status", key: "status", width: 18 },
    ];
            res.setHeader(
                "Content-type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
            res.setHeader(
                "Content-Disposition",
                `attachment filename="reports.xlsx"`
            );
            await wb.xlsx.write(res);
            res.end();
            console.log("log hiij uzej bn",response)
    }catch(error){
        console.log("error while fetching excel", error.message)
    }
}