import { Router } from "express";
import controller from "../controllers/quotation.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createQuotation);
router.get("/:id", controller.getOne);
router.post("/get", controller.getPage);
router.get("/getCus/:id", controller.getCusQuotation);
router.post("/assignExecutive", controller.assignExecutive);

export default router;
