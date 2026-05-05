import { Router } from "express";
import controller from "../controllers/idCreation.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Secure all routes as they are master settings
router.use(auth);

router.post("/", controller.createId);
router.put("/:id", controller.updateId);
router.delete("/:id", controller.deleteId);
router.get("/:id", controller.getOne);
router.post("/get", controller.getPage);
router.get("/", controller.getAll);

export default router;
