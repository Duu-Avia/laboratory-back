import { getConnection } from "../../config/connection-db.js";

export async function getLabTypes (req, res){
    try{
        const pool = await getConnection();
        // Return ALL lab types (both active and inactive) so frontend can show/manage them
        const result = await pool.request()
        .query(`SELECT * FROM lab_types ORDER BY is_active DESC, id`);
        res.json(result.recordset)
    }catch(err){
        console.log('error while getting lab_type', err)
        res.status(500).json({error:"Failed to get lab_type"})
    }
}
