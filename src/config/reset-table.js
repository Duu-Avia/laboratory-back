import { getConnection } from "./connection-db.js";

const resetTables = async () => {
    try{
        const pool = await getConnection();
        console.log('resetting tables...');
        await pool.request().query(`IF OBJECT_ID('test_results', 'U') IS NOT NULL DROP TABLE test_results`);
        console.log("✅ test_results table dropped");
        
        await pool.request().query(`IF OBJECT_ID('sample_indicators', 'U') IS NOT NULL DROP TABLE sample_indicators`);
        console.log("✅ sample_indicators table dropped");
        
        await pool.request().query(`IF OBJECT_ID('samples', 'U') IS NOT NULL DROP TABLE samples`);
        console.log("✅ samples table dropped");
       
        await pool.request().query(`IF OBJECT_ID('report_comments', 'U') IS NOT NULL DROP TABLE report_comments`)

        await pool.request().query(`IF OBJECT_ID('reports', 'U') IS NOT NULL DROP TABLE reports`);
        console.log("✅ reports table dropped");
        
        await pool.request().query(`IF OBJECT_ID('indicators', 'U') IS NOT NULL DROP TABLE indicators`);
        console.log("✅ indicators table dropped");
        
        await pool.request().query(`IF OBJECT_ID('location_samples', 'U') IS NOT NULL DROP TABLE location_samples`)
        console.log("✅ location_names table dropped")
        
        await pool.request().query(`IF OBJECT_ID('location_packages', 'U') IS NOT NULL DROP TABLE location_packages`)
        console.log("✅ location_packages table dropped")
        
        await pool.request().query(`IF OBJECT_ID('user_lab_types', 'U') IS NOT NULL DROP TABLE user_lab_types`);
        console.log("✅ user_lab_types table dropped")

        await pool.request().query(`IF OBJECT_ID('lab_types', 'U') IS NOT NULL DROP TABLE lab_types`);
        console.log("✅ lab_types table dropped");

        await pool.request().query(`IF OBJECT_ID('role_permissions', 'U') IS NOT NULL DROP TABLE role_permissions`);
        console.log("✅ role_permissions table dropped");
        
        await pool.request().query(`IF OBJECT_ID('activity_logs', 'U') IS NOT NULL DROP TABLE activity_logs`)
        console.log("✅ activity_logs table dropped")

        await pool.request().query(`IF OBJECT_ID('user_lab_types', 'U') IS NOT NULL DROP TABLE user_lab_types`)
        console.log("✅ user_lab_types table dropped")

        await pool.request().query(`IF OBJECT_ID('notifications', 'U') IS NOT NULL DROP TABLE notifications`)
        console.log("✅ notification table dropped ")

        await pool.request().query(`IF OBJECT_ID('users', 'U') IS NOT NULL DROP TABLE users`);
        console.log("✅ users table dropped");

        await pool.request().query(`IF OBJECT_ID('permissions', 'U') IS NOT NULL DROP TABLE permissions`);
        console.log("✅ permissions table dropped");

        await pool.request().query(`IF OBJECT_ID('roles', 'U') IS NOT NULL DROP TABLE roles`);
        console.log("✅ roles table dropped");

    }catch(error){
        console.error("Error resetting tables:", error);
    }
}

resetTables();