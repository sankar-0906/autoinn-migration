import express from "express";
import controller from "../controllers/inventoryTransfers.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * Routes for Inventory Transfers (Vehicles & Spares).
 * Mirroring legacy paths for frontend compatibility.
 */
router.use(auth);

router.get("/check", controller.check);
router.post("/vehicles", controller.getVehicles);
router.post("/colors", controller.getVehiclesColors);
router.post("/chassisNumbers", controller.getVehiclesChassisNumbers);
router.put("/vehicles", controller.transferVehicles);
router.post("/spares", controller.getSpares);
router.put("/spares", controller.transferSpares);

// Transfer records / history
router.post("/vehicle-transfers", controller.getVehicleTransferRecords);
router.post("/spare-transfers", controller.getSpareTransferRecords);
router.post("/numberPlate-transfers", controller.getNumberPlateTransferRecords);
router.post("/numberPlate", controller.transferNumberPlates);

export default router;
