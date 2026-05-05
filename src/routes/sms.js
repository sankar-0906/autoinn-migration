import express from "express";
import controller from "../controllers/sms.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", auth, controller.createSms);
router.put("/:id", auth, controller.updateSms);
router.delete("/:id/:type", auth, controller.deleteSms);
router.get("/getAll", auth, controller.getAll);
router.get("/", auth, controller.getAll); // Fix for 404
router.post("/get", auth, controller.getPage);
router.get("/smsReport", controller.smsReport);
router.post("/report", controller.smsReport);

// Template specific routes
router.post("/template/:id", auth, controller.createTemplate);
router.put("/template/:id", auth, controller.updateTemplate);

export default router;
