
// Auth
import Router from "express";
import { getAllPermissions, getMe, login, logout } from "../controller/auth-controller.js";
import { authMiddleware } from "../middleware/auth-middleware.js";
// Reports (жишээ)


export const routerExample = Router();
// ============ AUTH ROUTES (Нэвтэрч орж token авнашдээ хө) ============
routerExample.post("/login", login);
routerExample.post("/logout", logout);

// ============ PROTECTED ROUTES (нэвтэрсэн хэрэгтэй) ============

// Auth
routerExample.get("/me", authMiddleware, getMe);
routerExample.get("/permissions", authMiddleware, getAllPermissions);



export default routerExample;