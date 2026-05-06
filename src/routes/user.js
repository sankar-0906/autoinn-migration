import { Router } from "express";
import controller from "../controllers/user.js";
import { auth } from "../middlewares/auth.middleware.js";

import multer from "multer";

const forms = multer({
  limits: { fieldSize: 104857600 },
});

const router = Router();

// Public routes
router.post("/login", controller.login);
router.post("/register", forms.any(), controller.register);
router.get("/count", controller.getUsersCount);

// Protected routes
router.use(auth);

router.get("/", controller.getAllUsers);
router.get("/currentUser", controller.currentUser);
router.post("/token", controller.token);
router.get("/getUser/:id", controller.getUser);
router.get("/department", controller.department);
router.get("/branch", controller.branch);
router.post("/getUserRoleAccess", controller.getUserRoleAccess);
router.put("/updateStatus/:id", controller.updateStatus);
router.put("/updateUser/:id", forms.any(), controller.updateUser);
router.delete("/:id", controller.deleteUser);

// Paginated listing routes
router.post("/get", controller.getPage);
router.post("/get/employee", controller.getEmployee);

export default router;
