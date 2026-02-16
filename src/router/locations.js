import { Router } from "express";
import { getAllPackagesWithSamples, getLocationPackageDetail, getLocationPackages, getLocationSamples } from "../controller/locations/get-locations.js";
import { createLocationPackage, createLocationSample } from "../controller/locations/create-locations.js";
import { deleteLocationPackage, deleteLocationSample } from "../controller/locations/delete-locations.js";

export const locationRouters = Router();

locationRouters.get("/all-with-samples", getAllPackagesWithSamples)
locationRouters.get("/", getLocationPackages)
locationRouters.post("/", createLocationPackage)
locationRouters.get("/:id", getLocationPackageDetail)
locationRouters.put("/deactive/:id", deleteLocationPackage)
locationRouters.get("/samples/:id", getLocationSamples)
locationRouters.post("/samples/update/:id", createLocationSample)
locationRouters.put("/samples/deactive/:id", deleteLocationSample)