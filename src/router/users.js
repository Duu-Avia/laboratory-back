import { Router } from "express";
import { checkPermission } from "../middleware/auth-middleware.js";
import { getSeniorsByLabType, getUserLabTypes, assignUserLabTypes } from "../controller/users/user-lab-types.js";
import {
  getProfile, updateProfile, changeOwnPassword,
  getAllUsers, getUserById, createUser, updateUser,
  resetUserPassword, deactivateUser, changeUserRole
} from "../controller/users/users.js";
import { get } from "node:http";
import { getAllRoles } from "../controller/users/get-roles.js";

const usersRouter = Router();

// === Self-service (any authenticated user) ===
usersRouter.get("/profile", getProfile);
usersRouter.put("/profile", updateProfile);
usersRouter.put("/profile/password", changeOwnPassword);

// === Existing: seniors list ===
usersRouter.get("/seniors", getSeniorsByLabType);

// === Admin: user management ===
usersRouter.get("/", getAllUsers);
usersRouter.get("/roles/list",  getAllRoles);
usersRouter.post("/", checkPermission("user:create"), createUser);

// === Parameterized routes (must come after static paths) ===
usersRouter.get("/:id", checkPermission("user:read"), getUserById);
usersRouter.put("/:id", checkPermission("user:update"), updateUser);
usersRouter.delete("/:id", checkPermission("user:delete"), deactivateUser);
usersRouter.put("/:id/password", checkPermission("user:update"), resetUserPassword);
usersRouter.put("/:id/role", checkPermission("user:assign_role"), changeUserRole);
usersRouter.get("/:id/lab-types", getUserLabTypes);
usersRouter.post("/:id/lab-types", checkPermission("user:update"), assignUserLabTypes);

export default usersRouter;
