import sql from "mssql";
import { getConnection } from "../../config/connection-db.js";

// POST /location-packages
// Create a new location package
export async function createLocationPackage(req, res) {
  try {
    const { package_name, lab_type_id } = req.body;
    if (!package_name || !lab_type_id) {
      return res.status(400).json({ error: "package_name and lab_type_id are required" });
    }

    const pool = await getConnection();
    const result = await pool.request()
      .input("package_name", sql.NVarChar, package_name)
      .input("lab_type_id", sql.Int, lab_type_id)
      .query(`
        INSERT INTO location_packages (package_name, lab_type_id)
        VALUES (@package_name, @lab_type_id);
        SELECT SCOPE_IDENTITY() AS id
      `);

    res.status(201).json({
      id: result.recordset[0].id,
      package_name,
      lab_type_id
    });
  } catch (err) {
    console.error("Error creating location package:", err);
    res.status(500).json({ error: "Failed to create location package" });
  }
}

// POST /location-packages/:id/samples
// Create a new location sample under a package
export async function createLocationSample(req, res) {
  try {
    const location_package_id = Number(req.params.id);
    const { location_name, sort_order } = req.body;

    if (!location_package_id) {
      return res.status(400).json({ error: "Invalid package id" });
    }
    if (!location_name) {
      return res.status(400).json({ error: "location_name is required" });
    }

    const pool = await getConnection();
    const result = await pool.request()
      .input("location_name", sql.NVarChar, location_name)
      .input("sort_order", sql.Int, sort_order || 0)
      .input("location_package_id", sql.Int, location_package_id)
      .query(`
        INSERT INTO location_samples (location_name, sort_order, location_package_id)
        VALUES (@location_name, @sort_order, @location_package_id);
        SELECT SCOPE_IDENTITY() AS id
      `);

    res.status(201).json({
      id: result.recordset[0].id,
      location_name,
      sort_order: sort_order || 0,
      location_package_id
    });
  } catch (err) {
    console.error("Error creating location sample:", err);
    res.status(500).json({ error: "Failed to create location sample" });
  }
}
