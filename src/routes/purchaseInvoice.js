import { Router } from "express";
import controller from "../controllers/purchaseInvoice.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createPurchaseInvoice);
router.get("/:id", controller.getOne);
router.post("/get", controller.getPage);
router.put("/:id", controller.updatePurchaseInvoice);
router.delete("/:id", controller.deletePurchaseInvoice);
router.post("/checkDuplicateInvoiceNo", controller.checkDuplicateInvoiceNo);
router.post("/checkChassisNo", controller.checkChassisNumber);
router.post("/checkEngineNo", controller.checkEngineNumber);

export default router;
