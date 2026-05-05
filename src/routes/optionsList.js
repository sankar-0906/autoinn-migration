import { Router } from "express";
import controller from "../controllers/optionsList.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/get", controller.getList);
router.get("/man/:id", controller.getManufacturerVehicles);

export default router;
