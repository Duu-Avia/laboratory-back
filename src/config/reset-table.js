import { getConnection } from "./connection-db.js";

const resetTables = async () => {
    try{
        const pool = await getConnection();
        console.log('resetting tables...');

        
        await pool.request().query(`IF OBJECT_ID('report_samples', 'U') IS NOT NULL DROP TABLE report_samples`);
        console.log("✅ report_samples table dropped");

        await pool.request().query(`IF OBJECT_ID('packed_locations', 'U') IS NOT NULL DROP TABLE packed_locations`);
        console.log("✅ packed_locations table dropped");

        await pool.request().query(`IF OBJECT_ID('test_results', 'U') IS NOT NULL DROP TABLE test_results`);
        console.log("✅ test_results table dropped");

        await pool.request().query(`IF OBJECT_ID('sample_indicators', 'U') IS NOT NULL DROP TABLE sample_indicators`);
        console.log("✅ sample_indicators table dropped");

        await pool.request().query(`IF OBJECT_ID('samples', 'U') IS NOT NULL DROP TABLE samples`);
        console.log("✅ samples table dropped");

        await pool.request().query(`IF OBJECT_ID('indicators', 'U') IS NOT NULL DROP TABLE indicators`);
        console.log("✅ indicators table dropped");

        await pool.request().query(`IF OBJECT_ID('sample_types', 'U') IS NOT NULL DROP TABLE sample_types`);
        console.log("✅ sample_types table dropped");

        await pool.request().query(`IF OBJECT_ID('reports', 'U') IS NOT NULL DROP TABLE reports`);
        console.log("✅ reports table dropped");


    }catch(error){
        console.error("Error resetting tables:", error);
    }
}

resetTables();