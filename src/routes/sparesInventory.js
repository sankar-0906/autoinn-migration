import { Router } from "express";
import controller from "../controllers/sparesInventory.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createSparesInventory);
router.post("/getAllByBranch", controller.getAllByBranch);
router.post("/get", controller.getPage);

export default router;
