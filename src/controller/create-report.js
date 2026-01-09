import { getConnection } from "../config/connection-db.js";

export async function createReport(req, res) {
  try {
    console.log("report treagered")
    const { report_title, analyst, approved_by, test_start_date, test_end_date } = req.body;
    const pool = await getConnection();
    console.log(req.body)
    const result = await pool.request()
      .input('report_title', report_title)
      .input('analyst', analyst)
      .input('approved_by', approved_by)
      .input('test_start_date', test_start_date)
      .input('test_end_date', test_end_date)
      .input('status', 'draft')
      .query(`
        INSERT INTO reports 
          (report_title, analyst, approved_by, test_start_date, test_end_date, status)
        OUTPUT INSERTED.id
        VALUES 
          (@report_title, @analyst, @approved_by, @test_start_date, @test_end_date, @status)
      `);

    const reportId = result.recordset[0].id;

    res.json({ success: true, reportId });

  } catch (error) {
    console.log("Error creating report:", error);
    res.status(500).json({ success: false, error: "Failed to create report" });
  }
}
