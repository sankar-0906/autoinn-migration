import { Router } from "express";
import controller from "../controllers/materialIssue.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/get", controller.getPage);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", controller.delete);
router.get("/maxSlipNumber/:materialIssueId", controller.getMaxSlipNumber);
router.get("/jobMaterial/:id", controller.getJobMaterial);
router.get("/import-from-estimate/:jobOrderNo", controller.importFromEstimate);
router.get("/import-from-estimate-cso/:jobOrderNo", controller.importFromEstimateCso);
router.get("/:id", controller.getOne);

export default router;
