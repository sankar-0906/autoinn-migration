import { Router } from "express";
import controller from "../controllers/purchaseInvoice.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createPurchaseInvoice);
router.get("/:id", controller.getOne);
router.post("/get", controller.getPage);
router.post("/checkDuplicateInvoiceNo", controller.checkDuplicateInvoiceNo);

export default router;
