import { Router } from "express";
import controller from "../controllers/gstVerify.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.gstVerify);

export default router;
