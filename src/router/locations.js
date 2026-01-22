import { Router } from "express";
import { getLocationPackageDetail, getLocationPackages, getLocationSamples } from "../controller/get-locations.js";

export const locationRouters = Router();

locationRouters.get("/", getLocationPackages)
locationRouters.get("/:id", getLocationPackageDetail)
locationRouters.get("/samples/:id", getLocationSamples)