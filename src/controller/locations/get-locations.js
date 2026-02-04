import sql from "mssql";
import { getConnection } from "../../config/connection-db.js";

// GET /location-packages?lab_type_id=1
// Тухайн дээжний төрлийн бүх location package-ийг авах
export async function getLocationPackages(req, res) {
  const { lab_type_id } = req.query;
  try {
    const pool = await getConnection();
    let query = `
      SELECT id, package_name, lab_type_id, created_at
      FROM location_packages
    `;

    const request = pool.request();

    // lab_type_id байвал filter хийх
    if (lab_type_id) {
      query += ` WHERE lab_type_id = @lab_type_id`;
      request.input("lab_type_id", sql.Int, lab_type_id);
    }

    query += ` ORDER BY package_name`;

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching location packages:", err);
    res.status(500).json({ message: "Failed to fetch location packages", error: String(err.message) });
  }
}

// GET /location-packages/:id/samples
// Тухайн package-ийн бүх sample нэрсийг авах
export async function getLocationSamples(req, res) {
  const packageId = Number(req.params.id);
  if (!packageId) {
    return res.status(400).json({ message: "Invalid package id" });
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input("packageId", sql.Int, packageId)
      .query(`
        SELECT id, location_name, sort_order
        FROM location_samples
        WHERE location_package_id = @packageId
        ORDER BY sort_order, id
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching location samples:", err);
    res.status(500).json({ message: "Failed to fetch location samples", error: String(err.message) });
  }
}

// GET /location-packages/:id (package + samples хамт)
// Нэг package-ийн бүх мэдээллийг авах
export async function getLocationPackageDetail(req, res) {
  const packageId = Number(req.params.id);

  if (!packageId) {
    return res.status(400).json({ message: "Invalid package id" });
  }

  try {
    const pool = await getConnection();

    // Package мэдээлэл
    const packageResult = await pool.request()
      .input("packageId", sql.Int, packageId)
      .query(`
        SELECT id, package_name, lab_type_id, created_at
        FROM location_packages
        WHERE id = @packageId
      `);

    if (packageResult.recordset.length === 0) {
      return res.status(404).json({ message: "Package not found" });
    }

    // Sample нэрс
    const samplesResult = await pool.request()
      .input("packageId", sql.Int, packageId)
      .query(`
        SELECT id, location_name, sort_order
        FROM location_samples
        WHERE location_package_id = @packageId
        ORDER BY sort_order, id
      `);

    res.json({
      package: packageResult.recordset[0],
      samples: samplesResult.recordset,
    });
  } catch (err) {
    console.error("Error fetching location package detail:", err);
    res.status(500).json({ message: "Failed to fetch location package detail", error: String(err.message) });
  }
}