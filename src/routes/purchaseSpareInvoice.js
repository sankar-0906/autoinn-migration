import { Router } from "express";
import controller from "../controllers/purchaseSpareInvoice.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createPurchaseSpareInvoice);
router.get("/:id", controller.getOne);
router.put("/:id", controller.updatePurchaseSpareInvoice);
router.delete("/:id", controller.deletePurchaseSpareInvoice);
router.post("/get", controller.getPage);
router.post("/checkDuplicateInvoiceNo", controller.checkDuplicateInvoiceNo);

export default router;
