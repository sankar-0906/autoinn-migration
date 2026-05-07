import { Router } from "express";
import controller from "../controllers/vehicleInventory.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createVehicleInventory);
router.post("/get", controller.getPage);
router.post("/counts", controller.getInventoryCounts);
router.post("/getvehicles", controller.getVehiclesByModel);
router.get("/", controller.getAll);
router.get("/:id", controller.getOne);

export default router;
