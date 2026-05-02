import { Router } from "express";
import controller from "../controllers/whatsup.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.get("/", controller.getAll);
router.get("/getChatList", controller.getChatList);
router.get("/getChatMessage/:id", controller.getChatMessage);
router.get("/profile", controller.fetchProfileByNumber);

export default router;
