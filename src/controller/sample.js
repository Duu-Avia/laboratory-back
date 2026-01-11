import sql from "mssql";
import { getConnection } from "../config/connection-db.js";

// GET /sample-types/:id/indicators?defaultOnly=1 its indicator
export async function getIndicatorsBySampleType(req, res) {
  const sampleTypeId = Number(req.params.id);
  const defaultOnly = req.query.defaultOnly === "1";

  if (!sampleTypeId) return res.status(400).json({ message: "Invalid sample type id" });

  try {
    const pool = await getConnection();

    if (defaultOnly) {
      // If you're still using indicators.is_default:
      const r = await pool.request()
        .input("sampleTypeId", sql.Int, sampleTypeId)
        .query(`
          SELECT id, indicator_name, unit, test_method, limit_value
          FROM indicators
          WHERE sample_type_id = @sampleTypeId AND is_default = 1
          ORDER BY indicator_name
        `);

      return res.json(r.recordset);
    }

    const r = await pool.request()
      .input("sampleTypeId", sql.Int, sampleTypeId)
      .query(`
        SELECT id, indicator_name, unit, test_method, limit_value, is_default
        FROM indicators
        WHERE sample_type_id = @sampleTypeId
        ORDER BY indicator_name
      `);

    res.json(r.recordset);
  } catch (err) {
    res.status(500).json({ message: "Failed to load indicators", error: String(err.message ?? err) });
  }
}
