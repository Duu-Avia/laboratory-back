import { getConnection } from "../../config/connection-db.js";
export async function getAllRoles(req, res) {
    const pool =  await getConnection();
  try {
 
    // Fetch roles
    const response = await pool.request().query(`
      SELECT id, role_name, description
      FROM roles
    `);
const rolesMap = {};
    for (const row of response.recordset) {
      if (!rolesMap[row.user_id]) rolesMap[row.user_id] = [];
      rolesMap[row.user_id].push({ id: row.id, role_name: row.description });
    }

    const roles = response.recordset.map((u) => ({
      ...u,
      roles: rolesMap[u.id] || [],
    }));

    res.json(roles);
    console.log(roles)
  } catch (err) {
    console.error("roles error:", err);
    res.status(500).json({ message: "Алдаа гарлаа", error: String(err.message ?? err) });
  }
}
