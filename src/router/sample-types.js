import {Router} from "express"
import { getSampleTypes } from "../controller/sample-types/sample-types.js"
const sampleTypeRouter = Router()

sampleTypeRouter.get('/',  getSampleTypes) //true
// sampleTypeRouter.post()

export default sampleTypeRouter;