import { getConnection } from "../../config/connection-db.js";
import sql from 'mssql'

export async function createIndicator(req,res){
    const {sample_type_id, indicator_name, unit, test_method, limit_value, is_default} = req.body;
    console.log(indicator_name)
    try{
    const pool = await getConnection()
    const response = await pool.request()
    .input("sample_type_id", sql.Int, sample_type_id)
    .input("unit", sql.NVarChar(80), unit)
    .input("test_method", sql.NVarChar(80), test_method)
    .input("limit_value", sql.NVarChar(80), limit_value)
    .input("is_default", sql.Bit, is_default) 
    .input("indicator_name", sql.NVarChar(100), indicator_name)
    .query(`
        INSERT INTO indicators(sample_type_id, indicator_name, unit, test_method, limit_value, is_default)
        VALUES(@sample_type_id, @indicator_name, @unit, @test_method, @limit_value, @is_default)
        `)
    return res.json({message:"amjilttai shine indicator orlooshvv kkk"})
    }catch(error){
        console.error("indicator uusgehed aldaa garchlooo FAK",error.message)
        res.status(500).json({message:"indicator uusgehed aldaa garchlooo FAK"})
    }
}