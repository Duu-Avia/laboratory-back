import sql from "mssql";
import { getConnection } from "../../config/connection-db.js";

export async function deleteLabType(req, res){
    try{
        const labTypeId = Number(req.params.id);
        if(!labTypeId){
            return res.status(400).json({error:"Invalid lab type id"})
        }

        const pool = await getConnection();

        // First, remove all user assignments for this lab type
        // This will move users to the "Unassigned" (Хувиарлагдаагүй) state
        await pool.request()
        .input('labTypeId', sql.Int, labTypeId)
        .query(`DELETE FROM user_lab_types WHERE lab_type_id = @labTypeId`)

        // Then deactivate the lab type
        const result = await pool.request()
        .input('labTypeId', sql.Int, labTypeId)
        .query(`UPDATE lab_types SET is_active = 0 WHERE id = @labTypeId`)

        if(result.rowsAffected[0] === 0){
            return res.status(404).json({error:"Lab type not found"})
        }

        res.json({message:"Lab type deactivated successfully"})
    }catch(err){
        console.log('error while deactivating lab_type', err)
        res.status(500).json({error:"Failed to deactivate lab_type"})
    }
}
