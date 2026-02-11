import { getConnection } from "./connection-db.js";
import dotenv from "dotenv";

dotenv.config();

async function initDatabase() {
  try {
    const pool = await getConnection();

    // 1. Lab Types
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='lab_types' AND xtype='U')
      CREATE TABLE lab_types (
        id INT IDENTITY(1,1) PRIMARY KEY,
        type_name NVARCHAR(100) NOT NULL,
        standard NVARCHAR(100),
        is_active BIT DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);
    console.log("✅ lab_types table created");
    // 2. Indicators
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='indicators' AND xtype='U')
      CREATE TABLE indicators (
        id INT IDENTITY(1,1) PRIMARY KEY,
        lab_type_id INT FOREIGN KEY REFERENCES lab_types(id),
        indicator_name NVARCHAR(200) NOT NULL,
        unit NVARCHAR(50),
        test_method NVARCHAR(100),
        limit_value NVARCHAR(100),
        is_default BIT DEFAULT 0,
        input_type VARCHAR(20) DEFAULT 'detected',
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
        test_start_date DATE,
        test_end_date DATE,
        analyst NVARCHAR(100),
        status VARCHAR(50) DEFAULT 'draft',
        assigned_to INT NULL,
        created_by INT NULL,
        approved_by NVARCHAR(100),
        approved_at DATETIME NULL,
        signed_by NVARCHAR(100),
        signed_at DATETIME NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);
    console.log("✅ reports table created");

    // 4. Samples 
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='samples' AND xtype='U')
      CREATE TABLE samples (
        id INT IDENTITY(1,1) PRIMARY KEY,
        lab_type_id INT FOREIGN KEY REFERENCES lab_types(id),
        report_id INT FOREIGN KEY REFERENCES reports(id),
        sample_name NVARCHAR(300) NOT NULL,
        sample_amount NVARCHAR(50),
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
   // 7. Location  
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='location_packages' AND xtype = 'U')
      CREATE TABLE location_packages (
      id INT IDENTITY(1,1) PRIMARY KEY,
      package_name NVARCHAR(200) NOT NULL,
      lab_type_id INT FOREIGN KEY REFERENCES lab_types(id),
      is_active BIT DEFAULT 1,
      created_at DATETIME DEFAULT GETDATE(),
      )
      `);
    console.log("✅ location_packages table created")
      // 8. Location Samples
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = 'location_samples' AND xtype= 'U')
      CREATE TABLE location_samples(
      id INT IDENTITY(1,1) PRIMARY KEY,
      location_name NVARCHAR(200) NOT NULL,
      sort_order INT DEFAULT 0,
      location_package_id INT FOREIGN KEY REFERENCES location_packages(id),
      is_active BIT DEFAULT 1
      )
      `)
    console.log("✅ location_names table created")

        // 1 Roles table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='roles' AND xtype='U')
      CREATE TABLE roles (
      id INT IDENTITY(1,1) PRIMARY KEY,
      role_name VARCHAR(50) NOT NULL UNIQUE,
      description NVARCHAR(200),
      created_at DATETIME DEFAULT GETDATE()
    )
      `) 

    // Permissions table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='permissions' AND xtype='U')
      CREATE TABLE permissions (
      id INT IDENTITY(1,1) PRIMARY KEY,
      permission_key VARCHAR(100) NOT NULL UNIQUE,  -- 'report:create'
      permission_name NVARCHAR(100),                -- 'Тайлан үүсгэх'
      module VARCHAR(50),                           -- 'report', 'user', 'sample'
      created_at DATETIME DEFAULT GETDATE()
    )
      `) 

    // Role-Permission mapping
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='role_permissions' AND xtype='U')
       CREATE TABLE role_permissions (
      id INT IDENTITY(1,1) PRIMARY KEY,
      role_id INT NOT NULL FOREIGN KEY REFERENCES roles(id),
      permission_id INT NOT NULL FOREIGN KEY REFERENCES permissions(id),
      UNIQUE(role_id, permission_id)
    )`);

    // Users table
 await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
    CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,             -- ← Нэмэх (Дараа Keycloak-д) keycloak_id VARCHAR(100) UNIQUE, 
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    position_name NVARCHAR(100),
    full_name NVARCHAR(100),
    role_id INT FOREIGN KEY REFERENCES roles(id),
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
  )
`);
    // User-Lab Type mapping (which user belongs to which lab type)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_lab_types' AND xtype='U')
      CREATE TABLE user_lab_types (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
        lab_type_id INT NOT NULL FOREIGN KEY REFERENCES lab_types(id),
        created_at DATETIME DEFAULT GETDATE(),
        UNIQUE(user_id, lab_type_id)
      )
    `);
    console.log("✅ user_lab_types table created");

    // Add assigned_to column if not exists (for existing databases)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('reports') AND name = 'assigned_to')
        ALTER TABLE reports ADD assigned_to INT NULL;
    `);

    // Add created_by column if not exists (report ownership)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('reports') AND name = 'created_by')
        ALTER TABLE reports ADD created_by INT NULL;
    `);

    // Backfill created_by from analyst name for existing reports
    await pool.request().query(`
      UPDATE r
      SET r.created_by = u.id
      FROM reports r
      JOIN users u ON u.full_name = r.analyst
      WHERE r.created_by IS NULL AND r.analyst IS NOT NULL
    `);

    // Report Comments (rejection feedback, resubmission notes)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='report_comments' AND xtype='U')
      CREATE TABLE report_comments (
        id INT IDENTITY(1,1) PRIMARY KEY,
        report_id INT NOT NULL FOREIGN KEY REFERENCES reports(id),
        user_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
        comment NVARCHAR(MAX) NOT NULL,
        action_type VARCHAR(20) NOT NULL,
        created_at DATETIME DEFAULT GETDATE()
      )
    `);
    console.log("✅ report_comments table created");

    // Notifications table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='notifications' AND xtype='U')
      CREATE TABLE notifications (
        id INT IDENTITY(1,1) PRIMARY KEY,
        recipient_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
        sender_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
        type VARCHAR(50) NOT NULL,
        message NVARCHAR(500) NOT NULL,
        report_id INT NULL,
        is_read BIT DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Index for fast recipient queries
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_notifications_recipient_read')
        CREATE INDEX IX_notifications_recipient_read
        ON notifications (recipient_id, is_read, created_at DESC)
    `);
    console.log("✅ notifications table created");

    console.log("✅  tables created");
  } catch (error) {
    console.log("❌ Failed while creating tables", error);
    process.exit(1);
  }
}

initDatabase();
