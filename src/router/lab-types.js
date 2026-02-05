import {Router} from "express"
import { getLabTypes } from "../controller/lab-types/get-lab-types.js";
import { createLabType } from "../controller/lab-types/create-lab-types.js";
import { deleteLabType } from "../controller/lab-types/delete-lab-types.js";
import { reactivateLabType } from "../controller/lab-types/reactivate-lab-types.js";
import { checkPermission } from "../middleware/auth-middleware.js";

const labTypeRouter = Router()

labTypeRouter.get('/', getLabTypes)
labTypeRouter.post('/', checkPermission("labtype:create"), createLabType)
labTypeRouter.put('/:id/deactivate', checkPermission("labtype:delete"), deleteLabType)
labTypeRouter.put('/:id/reactivate', checkPermission("labtype:update"), reactivateLabType)

export default labTypeRouter;