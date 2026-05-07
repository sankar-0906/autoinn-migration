import { Router } from "express";
import controller from "../controllers/purchaseChallan.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createPurchaseChallan);
router.get("/getOne/:id", controller.getOne);
router.post("/get", controller.getPage);

// Missing parity routes
router.post("/frameNumber", controller.frameNumber);
router.post("/engineNumber", controller.engineNumber);
router.post("/manufacturer", controller.getManufacturer);
router.delete("/vehicle/:id", controller.deleteVehicle);

export default router;
