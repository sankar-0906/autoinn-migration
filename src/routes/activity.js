import { Router } from "express";
import controller from "../controllers/activity.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(auth);

router.post("/customers", controller.getAllActivitiesByCustomerIDs);

export default router;
