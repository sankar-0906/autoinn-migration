import { Router } from "express";
import controller from "../controllers/estimate.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createEstimate);
router.put("/:id", controller.updateEstimate);
router.put("/setEst/:id", controller.updateEstimateStatus);
router.get("/:id", controller.getOne);
router.post("/get", controller.getPage);
router.delete("/:id", controller.deleteEstimate);
router.get("/generatePDF/:id", controller.generatePDF);

export default router;
