import { getConnection } from "./connection-db.js"

const pool = await getConnection();

async function seedUserData() {
    try{
    // Roles
    await pool.request().query(`
       INSERT INTO roles (role_name, description) VALUES 
      ('superadmin', N'System owner - бүх эрхтэй'),
      ('admin', N'Lab Owner / Senior Engineer'),
      ('engineer', N'Дээж оруулах, шинжилгээний хариу оруулах')
      `);

      console.log("✅ Roles inserted");  
    // Permissions
    await pool.request().query(`
       INSERT INTO permissions (permission_key, permission_name, module) VALUES 
    -- System
    ('system:config', N'System тохиргоо', 'system'),
    ('lab:config', N'Lab тохиргоо', 'system'),

    -- Lab types
    ('labtype:create', N'Lab төрөл үүсгэх', 'labtype'),
    ('labtype:read', N'Lab төрөл харах', 'labtype'),
    ('labtype:update', N'Lab төрөл засах', 'labtype'),
    ('labtype:delete', N'Lab төрөл устгах', 'labtype'),

    -- Users
    ('user:create', N'User үүсгэх', 'user'),
    ('user:read', N'User харах', 'user'),
    ('user:update', N'User засах', 'user'),
    ('user:delete', N'User устгах', 'user'),
    ('user:assign_role', N'User-т role өгөх', 'user'),

    -- Reports
    ('report:create', N'Тайлан үүсгэх', 'report'),
    ('report:read', N'Тайлан харах', 'report'),
    ('report:update', N'Тайлан засах', 'report'),
    ('report:delete', N'Тайлан устгах', 'report'),
    ('report:approve', N'Тайлан батлах', 'report'),

    -- Test results
    ('result:create', N'Шинжилгээ үр дүн оруулах', 'result'),
    ('result:read', N'Шинжилгээ үр дүн харах', 'result'),
    ('result:update', N'Шинжилгээ үр дүн засах', 'result'),
    ('result:delete', N'Шинжилгээ үр дүн устгах', 'result'),

    -- Export
    ('export:pdf', N'PDF экспорт', 'export'),
    ('export:excel', N'Excel экспорт', 'export'),

    -- Sample types / Indicators
    ('sampletype:manage', N'Sample types удирдах', 'sampletype'),
    ('indicator:manage', N'Шинжилгээ CRUD', 'indicator')

      `);
      console.log("✅ Permissions inserted");
    // Role Permissions mapping
    // SuperAdmin (бүх эрх)
    await pool.request().query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT 1, id FROM permissions
      `);
      console.log("✅ SuperAdmin permissions assigned");
    // Admin (SuperAdmin-аас бусад)
   await pool.request().query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT 2, id FROM permissions 
      WHERE permission_key NOT IN ('system:config', 'user:assign_role')
    `)
    console.log("✅ Admin permissions assigned");

    // Engineer (зөвхөн тайлан, дээж, үр дүн)
    await pool.request().query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT 3, id FROM permissions 
      WHERE permission_key IN (
      'report:create', 'report:read', 'report:update',
      'result:create', 'result:read', 'result:update',
      'export:pdf', 'export:excel'
    )
      `);

    // Dummy users
    await pool.request().query(`
    INSERT INTO users (email, password_hash, full_name, role_id) VALUES
    ('superadmin@lab.com', 'temp123', N'Super Admin', 1),
    ('admin@lab.com', 'temp123', N'Админ Батболд', 2),
    ('engineer@lab.com', 'temp123', N'Инженер Болд', 3)
    `);
    console.log("✅ Dummy users inserted");
      console.log("✅ Engineer permissions assigned"); 
    }catch(err){
        console.error("❌ Error seeding user data:", err);
    }
}
seedUserData();
