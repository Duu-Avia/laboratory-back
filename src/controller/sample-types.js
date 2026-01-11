import { getConnection } from "../config/connection-db.js"; 

export async function getSampleTypes (req, res){
    try{
        const pool = await getConnection();
        const result = await pool.request()
        .query(`SELECT * FROM sample_types`);
        res.json(result.recordset)
    }catch(err){
        console.log('error while getting sample_type', err)
        res.status(500).json({error:"Failed to get sample_type"})
    }
    console.log("orj irj bn shvv!!!")
}