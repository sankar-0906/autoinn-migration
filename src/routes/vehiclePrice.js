import { Router } from "express";
import controller from "../controllers/vehiclePrice.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createVehiclePrice);
router.get("/latest/:vehicleId", controller.getLatestByVehicle);
router.put("/:id", controller.update);
router.delete("/:id", controller.delete);
router.get("/model/:id", controller.getModel);
router.get("/getColors/:id", controller.getColors);
router.get("/data/export", controller.exportData);
router.get("/:id", controller.getOne);
router.get("/", controller.getAll);
router.post("/get", controller.getPage);

export default router;
