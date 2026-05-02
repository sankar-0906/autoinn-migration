import { Router } from "express";
import controller from "../controllers/reports.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/vehicleCategory", controller.getCategoryOfVehicleReporting);
router.post("/vehicleService", controller.getVehicleService);
router.post("/vehicleServiceData", controller.getServiceDataList);
router.post("/partCharges", controller.partCharges);
router.post("/dashboard", controller.getDashboardData);

export default router;
