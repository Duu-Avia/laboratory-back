import { getConnection } from "../../config/connection-db.js";
import sql from "mssql";

export async function updateLabType(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid lab type id" });

  const { type_name, standard } = req.body;
  if (!type_name) {
    return res.status(400).json({ error: "type_name is required" });
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .input("type_name", sql.NVarChar(100), type_name)
      .input("standard", sql.NVarChar(100), standard || null)
      .query(`
        UPDATE lab_types
        SET type_name = @type_name,
            standard = @standard,
            updated_at = GETDATE()
        WHERE id = @id AND is_active = 1
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Lab type not found" });
    }

    res.json({ id, type_name, standard });
  } catch (err) {
    console.error("Error while updating lab_type:", err);
    res.status(500).json({ error: "Failed to update lab_type" });
  }
}
