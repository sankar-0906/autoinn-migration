import { Router } from "express";
import controller from "../controllers/jobInvoice.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createJobInvoice);
router.delete("/part", controller.deletePart);
router.get("/:id", controller.getOne);
router.put("/:id", controller.updateJobInvoice);
router.delete("/:id", controller.deleteJobInvoice);
router.get("/checkExistence/:id", controller.checkExistence);
router.get("/getJob/:id", controller.getJob);
router.post("/get", controller.getPage);
router.put("/updateStatus/:id", controller.updateStatus);
router.post("/updateStatus", controller.updateStatus);
router.post("/saveFeedback", controller.saveFeedback);
router.delete("/deleteFeedback/:id", controller.deleteFeedback);
router.post("/scheduled", controller.getScheduled);

export default router;
