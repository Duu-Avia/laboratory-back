import { Router } from "express";
import { getSeniorsByLabType, getUserLabTypes, assignUserLabTypes } from "../controller/users/user-lab-types.js";
import { checkPermission } from "../middleware/auth-middleware.js";

const usersRouter = Router();

// Any authenticated user can get seniors list (for report creation dropdown)
usersRouter.get("/seniors", getSeniorsByLabType);

// View user's lab types
usersRouter.get("/:id/lab-types", getUserLabTypes);

// Assign lab types to user (admin only)
usersRouter.post("/:id/lab-types", checkPermission("user:update"), assignUserLabTypes);

export default usersRouter;
