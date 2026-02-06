import sql from "mssql";
import { getConnection } from "../../config/connection-db.js";

// DELETE /location-packages/:id
// Soft delete a location package (set is_active = 0)
export async function deleteLocationPackage(req, res) {
  try {
    const packageId = Number(req.params.id);
    if (!packageId) {
      return res.status(400).json({ error: "Invalid package id" });
    }

    const pool = await getConnection();

    // First soft delete associated samples
    await pool.request()
      .input("packageId", sql.Int, packageId)
      .query(`UPDATE location_samples SET is_active = 0 WHERE location_package_id = @packageId`);

    // Then soft delete the package
    const result = await pool.request()
      .input("packageId", sql.Int, packageId)
      .query(`UPDATE location_packages SET is_active = 0 WHERE id = @packageId`);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Package not found" });
    }

    res.json({ message: "Location package deleted successfully" });
  } catch (err) {
    console.error("Error deleting location package:", err);
    res.status(500).json({ error: "Failed to delete location package" });
  }
}

// DELETE /location-samples/:id
// Soft delete a specific location sample (set is_active = 0)
export async function deleteLocationSample(req, res) {
  try {
    const sampleId = Number(req.params.id);
    if (!sampleId) {
      return res.status(400).json({ error: "Invalid sample id" });
    }

    const pool = await getConnection();
    const result = await pool.request()
      .input("sampleId", sql.Int, sampleId)
      .query(`UPDATE location_samples SET is_active = 0 WHERE id = @sampleId`);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Location sample not found" });
    }

    res.json({ message: "Location sample deleted successfully" });
  } catch (err) {
    console.error("Error deleting location sample:", err);
    res.status(500).json({ error: "Failed to delete location sample" });
  }
}
