import express from "express";
import controller from "../controllers/adjustSparesInventory.js";

import { auth } from "../middlewares/auth.middleware.js";

const router = express.Router();
router.use(auth);

/**
 * Routes for Adjust Spares Inventory module.
 * Parity with legacy endpoint structure.
 */
router.post("/get", controller.get);
router.post("/create", controller.create);
router.delete("/:id", controller.delete);

export default router;
