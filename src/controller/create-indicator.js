import { getConnection } from "../config/connection-db.js";

export async function createIndicator(req,res){
    const draft = req.body;
    console.log(draft)
    // try{
    // const pool = await getConnection();
    // const response = await pool.request()
    // .input() 
    // }catch(error){
    //     console.error("indicator uusgehed aldaa garchlooo FAK",error.message)
    //     res.status(500).json({message:"indicator uusgehed aldaa garchlooo FAK"})
    // }
}