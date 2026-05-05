import { Router } from "express";
import controller from "../controllers/jobOrderLog.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createJobOrderLog);
router.get("/getLogs/:id", controller.getLogs);
router.post("/get", controller.getPage);

export default router;
