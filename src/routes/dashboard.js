import { Router } from "express";
import controller from "../controllers/dashboard.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.getData);
router.get("/users", controller.getUsers);

export default router;
