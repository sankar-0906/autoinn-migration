import { Router } from "express";
import controller from "../controllers/frameNumber.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createFrameNumber);
router.put("/:id", controller.updateFrameNumber);
router.delete("/:id", controller.deleteFrameNumber);
router.get("/getOne/:id", controller.getOne);
router.get("/", controller.getAll);
router.post("/get", controller.getPage);

export default router;
