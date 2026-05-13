import express from "express";
import controller from "../controllers/ramp.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * Routes for Ramp operations.
 * Mirroring legacy project structure.
 */
router.use(auth);

router.get("/", controller.getAllRamps);
router.post("/assign", controller.assignJobToRamp);
router.post("/assignMechanic", controller.assignMechanicToRamp);
router.put("/update", controller.assignJobToRamp); // In legacy, update also assigned job to ramp
router.delete("/:rampId", controller.clearRamp);

export default router;
