import { Router } from "express";
import controller from "../controllers/stockCheck.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/get", controller.getPage);
router.post("/getAllByBranch", controller.getAllByBranch);
router.get("/:id", controller.getOne);

export default router;
