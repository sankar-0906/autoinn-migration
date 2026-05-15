import { Router } from "express";
import controller from "../controllers/pymidol.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Applying auth as per legacy structure
router.use(auth);

router.post("/market-info", controller.getMarketInfo);
router.post("/push", controller.pushToPymidol);

export default router;
