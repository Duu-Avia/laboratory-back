import { getConnection } from "../../config/connection-db.js";
import sql from "mssql";

export async function deactiveIndicator(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid indicator id" });

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .query(`
        UPDATE indicators
        SET is_active  = 0,
            updated_at = GETDATE()
        WHERE id = @id AND is_active = 1
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Indicator not found" });
    }

    res.json({ message: "Indicator deactivated successfully" });
  } catch (err) {
    console.error("Error while deactivating indicator:", err);
    res.status(500).json({ error: "Failed to deactivate indicator" });
  }
}