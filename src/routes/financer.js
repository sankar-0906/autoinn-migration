import { Router } from "express";
import controller from "../controllers/financer.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createFinancer);
router.put("/:id", controller.updateFinancer);
router.delete("/:id", controller.deleteFinancer);
router.get("/:id", controller.getOne);
router.get("/", controller.getAll);
router.post("/get", controller.getPage);

export default router;
