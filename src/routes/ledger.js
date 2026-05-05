import { Router } from "express";
import controller from "../controllers/ledger.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/bankAccount/:id", controller.getBankAccountLedger);
router.post("/cashAccount/:id", controller.getCashAccountLedger);
router.post("/customer/:id", controller.getCustomerLedger);
router.post("/employee/:id", controller.getEmployeeLedger);

export default router;
