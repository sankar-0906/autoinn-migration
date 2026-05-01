import { Router } from "express";
import controller from "../controllers/user.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Public routes
router.post("/login", controller.login);

// Protected routes
router.use(auth);

router.get("/currentUser", controller.currentUser);
router.get("/department", controller.department);
router.get("/branch", controller.branch);
router.post("/getUserRoleAccess", controller.getUserRoleAccess);
router.put("/updateStatus/:id", controller.updateStatus);

export default router;
