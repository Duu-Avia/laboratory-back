import { getConnection } from "./connection-db.js";
import dotenv from "dotenv";

dotenv.config();

async function seedData() {
  try {
    const pool = await getConnection();

    // 1. Clear old data
    await pool.request().query(`DELETE FROM test_results`);
    await pool.request().query(`DELETE FROM sample_indicators`);
    await pool.request().query(`DELETE FROM samples`);
    await pool.request().query(`DELETE FROM indicators`);
    await pool.request().query(`DELETE FROM sample_types`);
    console.log("✅ Old data cleared");

    // 2. Insert Sample Types
    const waterResult = await pool.request().query(`
      INSERT INTO sample_types (type_code, type_name, standard) 
      OUTPUT INSERTED.id
      VALUES ('WT', N'Унд ахуйн ус', 'MNS 0900:2018')
    `);
    const waterTypeId = waterResult.recordset[0].id;

    const airResult = await pool.request().query(`
      INSERT INTO sample_types (type_code, type_name, standard) 
      OUTPUT INSERTED.id
      VALUES ('AR', N'Агаар', 'MNS 5484:2005')
    `);
    const airTypeId = airResult.recordset[0].id;

    const swabResult = await pool.request().query(`
      INSERT INTO sample_types (type_code, type_name, standard) 
      OUTPUT INSERTED.id
      VALUES ('SW', N'Арчдас', 'MNS 6410:2018')
    `);
    const swabTypeId = swabResult.recordset[0].id;

    console.log("✅ Sample types inserted:", { waterTypeId, airTypeId, swabTypeId });

    // 3. Insert Water Indicators
    await pool.request().query(`
      INSERT INTO indicators (sample_type_id, indicator_name, unit, test_method, limit_value, is_default) VALUES
      (${waterTypeId}, N'Бичил биетний ерөнхий тоо', N'CFU/мл', 'MNS ISO 6222-1998', N'1мл-т 100', 1),
      (${waterTypeId}, N'E.coli', N'илрэх/илрэхгүй', 'MNS ISO 9308-1:1998', N'100мл-т илрэхгүй', 1),
      (${waterTypeId}, N'ГБЭТ нян', N'илрэх/илрэхгүй', 'MNS ISO 19250:2017', N'25мл-т илрэхгүй', 1),
      (${waterTypeId}, N'Salmonella', N'илрэх/илрэхгүй', 'MNS ISO 19250:2017', N'илрэхгүй', 0)
    `);
    console.log("✅ Water indicators inserted");

    // 4. Insert Air Indicators
    await pool.request().query(`
      INSERT INTO indicators (sample_type_id, indicator_name, unit, test_method, limit_value, is_default) VALUES
      (${airTypeId}, N'Бактерийн нийт тоо', N'CFU/м³', 'MNS 5484:2005', N'1м³-д <50', 1),
      (${airTypeId}, N'Staphylococcus ssp', N'илрэх/илрэхгүй', 'MNS 5484:2005', N'илрэхгүй', 1)
    `);
    console.log("✅ Air indicators inserted");

    // 5. Insert Swab Indicators
    await pool.request().query(`
      INSERT INTO indicators (sample_type_id, indicator_name, unit, test_method, limit_value, is_default) VALUES
      (${swabTypeId}, N'Бактерийн нийт тоо', N'CFU/50см²', 'MNS 6410:2018', N'50см²-д <100', 1),
      (${swabTypeId}, N'E.coli', N'илрэх/илрэхгүй', 'MNS 6410:2018', N'илрэхгүй', 1),
      (${swabTypeId}, N'Salmonella spp', N'илрэх/илрэхгүй', 'MNS 6410:2018', N'илрэхгүй', 1)
    `);
    console.log("✅ Swab indicators inserted");

    console.log("🎉 All seed data inserted!");
    process.exit(0);

  } catch (error) {
    console.log("❌ Failed to insert seed data", error);
    process.exit(1);
  }
}

seedData();