import { Router } from "express";
import { getLocationPackageDetail, getLocationPackages, getLocationSamples } from "../controller/locations/get-locations.js";
import { createLocationPackage, createLocationSample } from "../controller/locations/create-locations.js";
import { deleteLocationPackage, deleteLocationSample } from "../controller/locations/delete-locations.js";

export const locationRouters = Router();

locationRouters.get("/", getLocationPackages)
locationRouters.post("/", createLocationPackage)
locationRouters.get("/:id", getLocationPackageDetail)
locationRouters.delete("/:id", deleteLocationPackage)
locationRouters.get("/samples/:id", getLocationSamples)
locationRouters.post("/:id/samples", createLocationSample)
locationRouters.delete("/samples/:id", deleteLocationSample)