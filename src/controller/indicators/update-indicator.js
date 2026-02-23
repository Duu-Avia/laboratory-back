import { getConnection } from "../../config/connection-db.js";
import sql from "mssql";

export async function updateIndicator(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid indicator id" });

  const { indicator_name, unit, test_method, limit_value, is_default } = req.body;
  if (!indicator_name) {
    return res.status(400).json({ error: "indicator_name is required" });
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .input("indicator_name", sql.NVarChar(200), indicator_name)
      .input("unit", sql.NVarChar(50), unit || null)
      .input("test_method", sql.NVarChar(100), test_method || null)
      .input("limit_value", sql.NVarChar(100), limit_value || null)
      .input("is_default", sql.Bit, is_default ? 1 : 0)
      .query(`
        UPDATE indicators
        SET indicator_name = @indicator_name,
            unit           = @unit,
            test_method    = @test_method,
            limit_value    = @limit_value,
            is_default     = @is_default,
            updated_at     = GETDATE()
        WHERE id = @id AND is_active = 1
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Indicator not found" });
    }

    res.json({ id, indicator_name, unit, test_method, limit_value, is_default });
  } catch (err) {
    console.error("Error while updating indicator:", err);
    res.status(500).json({ error: "Failed to update indicator" });
  }
}