import { Router } from "express";
import { checkPermission } from "../middleware/auth-middleware.js";
import { getSeniorsByLabType, getUserLabTypes, assignUserLabTypes } from "../controller/users/user-lab-types.js";
import {
  getProfile, updateProfile, changeOwnPassword,
  getAllUsers, getUserById, createUser, updateUser,
  resetUserPassword, deactivateUser, changeUserRole
} from "../controller/users/users.js";
import { getAllRoles } from "../controller/users/get-roles.js";
import { getActivityLogs } from "../controller/active-logs/activity-logs.js";

const usersRouter = Router();

// === Self-service (any authenticated user) ===
usersRouter.get("/profile", getProfile);
usersRouter.put("/profile", updateProfile);
usersRouter.put("/profile/password", changeOwnPassword);

 
// === activity log awah api ===
usersRouter.get("/logs", checkPermission("system:config"), getActivityLogs)

// === Existing: seniors list ===
usersRouter.get("/seniors", getSeniorsByLabType);

// === Admin: user management ===
usersRouter.get("/", getAllUsers);
usersRouter.get("/roles/list",  getAllRoles);
usersRouter.post("/", checkPermission("user:create"), createUser);

// === Parameterized routes (must come after static paths) ===
usersRouter.get("/:id", checkPermission("user:read"), getUserById);
usersRouter.put("/update/:id", checkPermission("user:update"), updateUser);
usersRouter.put("/deactive/:id", checkPermission("user:delete"), deactivateUser);
usersRouter.put("/password/:id", checkPermission("user:update"), resetUserPassword);
usersRouter.put("/role/:id", checkPermission("user:assign_role"), changeUserRole);
usersRouter.get("/lab-types/:id", getUserLabTypes);
usersRouter.post("/lab-types/:id", checkPermission("user:update"), assignUserLabTypes);

export default usersRouter;
