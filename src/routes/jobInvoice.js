import { Router } from "express";
import controller from "../controllers/jobInvoice.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createJobInvoice);
router.get("/:id", controller.getOne);
router.post("/get", controller.getPage);

export default router;
