import { getConnection } from "./connection-db.js";
import dotenv from "dotenv";

dotenv.config();

async function initDatabase() {
  try {
    const pool = await getConnection();

    // 1. Sample Types
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='sample_types' AND xtype='U')
      CREATE TABLE sample_types (
        id INT IDENTITY(1,1) PRIMARY KEY,
        type_code VARCHAR(10) NOT NULL,
        type_name NVARCHAR(100) NOT NULL,
        standard NVARCHAR(100),
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);
    console.log("✅ sample_types table created");

    // 2. Indicators
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='indicators' AND xtype='U')
      CREATE TABLE indicators (
        id INT IDENTITY(1,1) PRIMARY KEY,
        sample_type_id INT FOREIGN KEY REFERENCES sample_types(id),
        indicator_name NVARCHAR(200) NOT NULL,
        unit NVARCHAR(50),
        test_method NVARCHAR(100),
        limit_value NVARCHAR(100),
        is_default BIT DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);
    console.log("✅ indicators table created");

    // 3. Reports
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='reports' AND xtype='U')
      CREATE TABLE reports (
        id INT IDENTITY(1,1) PRIMARY KEY,
        report_title NVARCHAR(200),
        test_start_date DATE,
        test_end_date DATE,
        approved_by NVARCHAR(100),
        analyst NVARCHAR(100),
        status VARCHAR(50) DEFAULT 'draft',
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);
    console.log("✅ reports table created");

    // 4. Samples (with report_id)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='samples' AND xtype='U')
      CREATE TABLE samples (
        id INT IDENTITY(1,1) PRIMARY KEY,
        report_id INT NULL FOREIGN KEY REFERENCES reports(id) ON DELETE SET NULL,
        sample_type_id INT FOREIGN KEY REFERENCES sample_types(id),
        sample_name NVARCHAR(300) NOT NULL,
        sample_amount VARCHAR(50),
        location NVARCHAR(200),
        sample_date DATE,
        sampled_by NVARCHAR(100),
        status VARCHAR(50) DEFAULT 'pending',
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);
    console.log("✅ samples table created");

    // 5. Sample Indicators
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='sample_indicators' AND xtype='U')
      CREATE TABLE sample_indicators (
        id INT IDENTITY(1,1) PRIMARY KEY,
        sample_id INT FOREIGN KEY REFERENCES samples(id) ON DELETE CASCADE,
        indicator_id INT FOREIGN KEY REFERENCES indicators(id),
        analyst NVARCHAR(100),
        test_date DATE,
        status VARCHAR(50) DEFAULT 'pending',
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);
    console.log("✅ sample_indicators table created");

    // 6. Test Results
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='test_results' AND xtype='U')
      CREATE TABLE test_results (
        id INT IDENTITY(1,1) PRIMARY KEY,
        sample_indicator_id INT FOREIGN KEY REFERENCES sample_indicators(id) ON DELETE CASCADE,
        result_value VARCHAR(100),
        is_detected BIT,
        is_within_limit BIT,
        equipment_id NVARCHAR(100),
        notes NVARCHAR(MAX),
        measured_at DATETIME,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);
    console.log("✅ test_results table created");

    // 7. Packed Locations (optional)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='packed_locations' AND xtype='U')
      CREATE TABLE packed_locations(
        id INT IDENTITY(1,1) PRIMARY KEY,
        location_name NVARCHAR(200) NOT NULL,
        description NVARCHAR(500),
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);
    console.log("✅ packed_locations table created");

  } catch (error) {
    console.log("❌ Failed while creating tables", error);
    process.exit(1);
  }
}

initDatabase();
