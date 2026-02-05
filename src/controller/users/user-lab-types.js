import sql from "mssql";
import { getConnection } from "../../config/connection-db.js";

/**
 * GET /users/seniors?lab_type_id=1
 * Returns senior engineers (admin role) assigned to a given lab type.
 * Used by frontend to populate "assign to" dropdown when creating reports.
 */
export async function getSeniorsByLabType(req, res) {
  const labTypeId = Number(req.query.lab_type_id);

  if (!labTypeId) {
    return res.status(400).json({ message: "lab_type_id query parameter is required" });
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input("labTypeId", sql.Int, labTypeId)
      .query(`
        SELECT u.id, u.full_name, u.email
        FROM users u
        JOIN roles r ON r.id = u.role_id
        JOIN user_lab_types ult ON ult.user_id = u.id
        WHERE r.role_name = 'admin'
          AND ult.lab_type_id = @labTypeId
          AND u.is_active = 1
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("getSeniorsByLabType error:", err);
    res.status(500).json({ message: "Алдаа гарлаа", error: String(err.message ?? err) });
  }
}

/**
 * GET /users/:id/lab-types
 * Returns lab types assigned to a specific user.
 */
export async function getUserLabTypes(req, res) {
  const userId = Number(req.params.id);
  if (!userId) return res.status(400).json({ message: "Invalid user id" });

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT lt.id, lt.type_name
        FROM user_lab_types ult
        JOIN lab_types lt ON lt.id = ult.lab_type_id
        WHERE ult.user_id = @userId
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("getUserLabTypes error:", err);
    res.status(500).json({ message: "Алдаа гарлаа", error: String(err.message ?? err) });
  }
}

/**
 * POST /users/:id/lab-types
 * Assigns lab types to a user. Replaces existing assignments.
 * Body: { lab_type_ids: [1, 2, 3] }
 */
export async function assignUserLabTypes(req, res) {
  const userId = Number(req.params.id);
  const { lab_type_ids } = req.body;

  if (!userId) return res.status(400).json({ message: "Invalid user id" });
  if (!Array.isArray(lab_type_ids)) {
    return res.status(400).json({ message: "lab_type_ids must be an array" });
  }

  try {
    const pool = await getConnection();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    // Remove existing assignments
    await new sql.Request(tx)
      .input("userId", sql.Int, userId)
      .query(`DELETE FROM user_lab_types WHERE user_id = @userId`);

    // Insert new assignments
    for (const labTypeId of lab_type_ids) {
      await new sql.Request(tx)
        .input("userId", sql.Int, userId)
        .input("labTypeId", sql.Int, labTypeId)
        .query(`INSERT INTO user_lab_types (user_id, lab_type_id) VALUES (@userId, @labTypeId)`);
    }

    await tx.commit();
    res.json({ message: "Лабораторийн төрөл амжилттай хуваарилагдлаа", user_id: userId, lab_type_ids });
  } catch (err) {
    console.error("assignUserLabTypes error:", err);
    res.status(500).json({ message: "Алдаа гарлаа", error: String(err.message ?? err) });
  }
}
