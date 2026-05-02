import { Router } from "express";
import controller from "../controllers/jobOrder.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createJobOrder);
router.get("/:id", controller.getOne);
router.post("/get", controller.getPage);
router.post("/dashboard", controller.getDashboardData);
router.post("/setStatus", controller.setStatus);

export default router;
