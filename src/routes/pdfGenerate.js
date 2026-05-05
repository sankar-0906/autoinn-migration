import { Router } from "express";
import controller from "../controllers/pdfGenerate.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/quotation", controller.createQuotationPDF);
router.post("/booking", controller.createBookingPDF);

export default router;
