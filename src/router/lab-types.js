import {Router} from "express"
import { getLabTypes } from "../controller/lab-types/lab-types.js";
const labTypeRouter = Router()

labTypeRouter.get('/',  getLabTypes) //true
// sampleTypeRouter.post()

export default labTypeRouter;