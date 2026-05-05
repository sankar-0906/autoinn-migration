import { Router } from "express";
import controller from "../controllers/vehicleInventory.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createVehicleInventory);
router.get("/:id", controller.getOne);
router.get("/", controller.getAll);
router.post("/get", controller.getPage);
router.post("/counts", controller.getInventoryCounts);

export default router;
