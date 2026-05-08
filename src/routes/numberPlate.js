import express from "express";
import controller from "../controllers/numberPlate.js";
import { auth } from "../middlewares/auth.middleware.js";
import multer from "multer";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

/**
 * Routes for Number Plate operations.
 * Mirroring legacy paths for frontend compatibility.
 */
router.use(auth);

router.get("/check", controller.check);
router.post("/get", controller.get);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

// Status updates
router.post("/status/received", controller.statusReceived);
router.post("/status/fixed", controller.statusFixed);

// Bulk upload
router.post("/upload", upload.array("pdfFiles", 10), controller.upload);

export default router;
