import { Router } from "express";
import controller from "../controllers/soldVehicle.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.get("/vehicleNum/:id", controller.getByRegNum);
router.get("/:id", controller.getOne);
router.get("/", controller.getAll);
router.post("/get", controller.getPage);

export default router;
