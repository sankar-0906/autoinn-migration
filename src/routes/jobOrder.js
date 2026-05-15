import { Router } from "express";
import controller from "../controllers/jobOrder.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createJobOrder);
router.get("/vehicleHistory/:id", controller.historyVehicleJobs);
router.get("/generatePDF/:id", controller.generatePDF);
router.get("/:id", controller.getOne);
router.post("/get", controller.getPage);
router.post("/getPendingInProgress", controller.getPendingInProgress);
router.post("/getJoborder", controller.getJoborder);
router.post("/getJobNo", controller.getJobNo);
router.post("/dashboard", controller.getDashboardData);
router.post("/setStatus", controller.setStatus);
router.put("/setMech/:id", controller.updateMechanic);
router.put("/:id", controller.updateJobOrder);
router.delete("/:id", controller.deleteJobOrder);

// Missing parity routes
router.post("/history", controller.historyJobOrder);
router.post("/vehicleHistory", controller.vehicleJobOrder);

export default router;
