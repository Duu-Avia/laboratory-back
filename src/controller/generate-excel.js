import ExcelJS from "exceljs"
import { getConnection } from "../config/connection-db.js";
import sql from "mssql"

export async function generateExcel(req,res){
    const status = req.query.status ?? "all";
    const type = req.query.type ?? "all";
    const search = req.query.search ?? "";
    try{
        const pool = await getConnection()
        const response = await pool.request()
        .input('status', sql.NVarChar(50), status)
        // .input('type', sql.NVarChar(50), type)
        // .input('search', sql.NVarChar(100), search)
        .query(`
            SELECT  
            r.id,   
            r.created_at,
            r.status,
            STUFF((SELECT DISTINCT ', ' + s2.sample_name
            FROM samples s2
            WHERE s2.report_id = r.id
            FOR XML PATH(''), TYPE
            ).value('.', 'NVARCHAR(MAX)'),1,2,'') AS sample_names,

            s.sampled_by,
            STUFF((SELECT DISTINCT ', ' + i2.indicator_name
            FROM samples sx
            JOIN sample_indicators si2 ON si2.sample_id = sx.id
            JOIN indicators i2 ON i2.id = si2.indicator_id
            WHERE sx.report_id = r.id
            FOR XML PATH(''), TYPE
            ).value('.', 'NVARCHAR(MAX)'),1,2, '') AS indicator_names,

            st.type_name
            FROM reports r
            JOIN samples s ON s.report_id = r.id
            JOIN lab_types st ON st.id = s.lab_type_id
            WHERE (r.status = @status OR r.status != 'deleted')
            GROUP BY
            r.id, r.created_at, r.status, st.type_name, s.sampled_by
            ORDER BY r.created_at DESC;
            `)
            const rows = response.recordset
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet("Тайлан")
                ws.columns = [
      { header: "Он сар", key: "created_at", width: 14 },
      { header: "Дугаар", key: "id", width: 10 },
      { header: "Оруулсан дээжүүд", key: "sample_names", width: 40 },
      {header:"Сонгогдсон шинжилгээ", key:"indicator_names", width:40},
      { header: "Байршил", key: "location", width: 25 },
      { header: "Төлөв", key: "status", width: 18 },
    ];
            res.setHeader(
                "Content-type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="reports.xlsx"`
            );

        for(const row of rows){
          const excelRow =  ws.addRow({
                created_at: row.created_at,
                sample_names:row.sample_names ? row.sample_names.split(",").join("\n") : "",
                indicator_names:row.indicator_names ? row.indicator_names.split(",").join("\n") : "",
                location:row.location,
                status:row.status
            })
             excelRow.getCell("sample_names").alignment = {wrapText: true, vertical: "center"}
             excelRow.getCell("indicator_names").alignment = {wrapText: true, vertical: "center"}
        }

           
            await wb.xlsx.write(res);
            res.end();
    }catch(error){
        console.log("error while fetching excel", error.message)
    }
}