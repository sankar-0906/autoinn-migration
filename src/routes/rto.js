import { Router } from "express";
import controller from "../controllers/rto.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware to all RTO routes as per legacy
router.use(auth);

router.post("/", controller.createRto);
router.get("/", controller.getAll);
router.get("/:id", controller.getOne);
router.delete("/:id", controller.deleteRto);
router.post("/get", controller.getPage);
router.put("/:id", controller.updateRto);

export default router;
