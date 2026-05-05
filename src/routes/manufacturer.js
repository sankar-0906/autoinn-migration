import { Router } from "express";
import controller from "../controllers/manufacturer.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createManufacturer);
router.put("/:id", controller.updateManufacturer);
router.delete("/:id", controller.deleteManufacturer);
router.get("/getOne/:id", controller.getOne);
router.get("/", controller.getAll);
router.get("/branch", controller.getBranch);
router.post("/get", controller.getPage);

export default router;
