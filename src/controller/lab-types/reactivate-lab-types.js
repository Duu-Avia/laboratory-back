import sql from "mssql";
import { getConnection } from "../../config/connection-db.js";

export async function reactivateLabType(req, res){
    try{
        const labTypeId = Number(req.params.id);
        if(!labTypeId){
            return res.status(400).json({error:"Invalid lab type id"})
        }

        const pool = await getConnection();

        // Reactivate the lab type by setting is_active = 1
        const result = await pool.request()
        .input('labTypeId', sql.Int, labTypeId)
        .query(`UPDATE lab_types SET is_active = 1 WHERE id = @labTypeId`)

        if(result.rowsAffected[0] === 0){
            return res.status(404).json({error:"Lab type not found"})
        }

        res.json({message:"Lab type reactivated successfully"})
    }catch(err){
        console.log('error while reactivating lab_type', err)
        res.status(500).json({error:"Failed to reactivate lab_type"})
    }
}
