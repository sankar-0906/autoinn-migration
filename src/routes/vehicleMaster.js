import { Router } from "express";
import controller from "../controllers/vehicleMaster.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createVehicleMaster);
router.get("/man/:id", controller.getModel);
router.get("/getOne/:id", controller.getOne);
router.get("/", controller.getAll);
router.post("/get", controller.getPage);

export default router;
