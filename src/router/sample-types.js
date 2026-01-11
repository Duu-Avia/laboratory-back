import {Router} from "express"
import { getSampleTypes } from "../controller/sample-types.js"

const sampleTypeRouter = Router()

sampleTypeRouter.get('/',getSampleTypes)

export default sampleTypeRouter;