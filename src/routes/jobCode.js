import { Router } from "express";
import controller from "../controllers/jobCode.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createJobCode);
router.put("/:id", controller.updateJobCode);
router.delete("/:id", controller.deleteJobCode);
router.get("/template", controller.template);
router.get("/data/export", controller.exportData);
router.get("/:id", controller.getOne);
router.get("/", controller.getAll);
router.post("/get", controller.getPage);

export default router;
