import { Router } from "express";
import controller from "../controllers/telecmi-webhooks.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/phoneDialHistory", controller.getPhoneDialHistory);
router.post("/callhistory/:phoneNumber", controller.getCallHistoryForNumber);
router.get("/teleUser", controller.getAllTeleUsers);
router.post("/teleUser", controller.createUser);
router.post("/teleUser/toggleStatus/:id", controller.updateStatus);
router.delete("/teleUser/:id", controller.deleteTeleUser);

export default router;
