import { Router } from "express";
import { getLocationPackageDetail, getLocationPackages, getLocationSamples } from "../controller/locations/get-locations.js";

export const locationRouters = Router();

locationRouters.get("/", getLocationPackages)
locationRouters.get("/:id", getLocationPackageDetail)
locationRouters.get("/samples/:id", getLocationSamples)