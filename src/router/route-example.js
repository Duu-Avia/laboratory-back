
// Auth
import Router from "express";
import { getAllPermissions, getMe, login } from "../controller/auth-controller.js";
import { authMiddleware } from "../middleware/auth-middleware.js";
// Reports (жишээ)


export const routerExample = Router();
// ============ AUTH ROUTES (Нэвтэрч орж token авнашдээ хө) ============
routerExample.post("/login", login);

// ============ PROTECTED ROUTES (нэвтэрсэн хэрэгтэй) ============

// Auth
routerExample.get("/me", authMiddleware, getMe);
routerExample.get("/permissions", authMiddleware, getAllPermissions);



export default routerExample;