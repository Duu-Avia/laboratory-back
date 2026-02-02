import { getConnection } from "../../config/connection-db.js";

export async function getAllIndicators(req, res){
    try{
    const pool = await getConnection();
    const response = await pool.request()
    .query(`
        SELECT 
        i.id,
        i.indicator_name,
        i.unit,
        i.test_method,
        i.limit_value,
        i.is_default,
        i.input_type,
        i.created_at,
        i.updated_at,
        i.lab_type_id
        FROM indicators i
        `)
        const rows = response.recordset;
       
        res.json(rows)
    }catch(error){
    console.error(error,"indicator query deer aldaa garsan bhooo")
    res.status(500).json({message:"indicator tatahad aldaa garlaashvv kkk"})
    }
}