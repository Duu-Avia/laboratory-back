import sql from "mssql";
import { getConnection } from "../../config/connection-db.js";

// DELETE /location-packages/:id
// Delete a location package (will cascade delete samples if FK is set up properly)
export async function deleteLocationPackage(req, res) {
  try {
    const packageId = Number(req.params.id);
    if (!packageId) {
      return res.status(400).json({ error: "Invalid package id" });
    }

    const pool = await getConnection();

    // First delete associated samples
    await pool.request()
      .input("packageId", sql.Int, packageId)
      .query(`DELETE FROM location_samples WHERE location_package_id = @packageId`);

    // Then delete the package
    const result = await pool.request()
      .input("packageId", sql.Int, packageId)
      .query(`DELETE FROM location_packages WHERE id = @packageId`);

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
// Delete a specific location sample
export async function deleteLocationSample(req, res) {
  try {
    const sampleId = Number(req.params.id);
    if (!sampleId) {
      return res.status(400).json({ error: "Invalid sample id" });
    }

    const pool = await getConnection();
    const result = await pool.request()
      .input("sampleId", sql.Int, sampleId)
      .query(`DELETE FROM location_samples WHERE id = @sampleId`);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Location sample not found" });
    }

    res.json({ message: "Location sample deleted successfully" });
  } catch (err) {
    console.error("Error deleting location sample:", err);
    res.status(500).json({ error: "Failed to delete location sample" });
  }
}
