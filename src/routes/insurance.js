import { Router } from "express";
import controller from "../controllers/insurance.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createInsurance);
router.put("/:id", controller.updateInsurance);
router.delete("/:id", controller.deleteInsurance);
router.get("/:id", controller.getOne);
router.get("/", controller.getAll);
router.post("/get", controller.getPage);

export default router;
