import { getConnection } from "../../config/connection-db.js";

export async function createLabType(req, res){
    try{
        const {type_name, standard} = req.body;
        if(!type_name){
            return res.status(400).json({error:"type_name is required"})
        }
        const pool = await getConnection();
        const result = await pool.request()
        .input('type_name', type_name)
        .input('standard', standard || null)
        .query(`INSERT INTO lab_types(type_name, standard) VALUES(@type_name, @standard); SELECT SCOPE_IDENTITY() AS id`)
        res.status(201).json({ id: result.recordset[0].id, type_name, standard })
    }catch(err){
        console.log('error while creating lab_type', err)
        res.status(500).json({error:"Failed to create lab_type"})
    }
}
