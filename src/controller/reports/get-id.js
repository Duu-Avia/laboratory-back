import sql from "mssql";
import { getConnection } from "../../config/connection-db.js";

export async function getNextReportId(req, res) {
  try {
    const pool = await getConnection();
    const year = new Date().getFullYear();

    const r = await pool.request().query(
      `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM reports`
    );

    const nextId = r.recordset[0].next_id;
    res.json({ next_id: `${year}_${nextId}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get next report id", error: String(err?.message ?? err) });
  }
}

