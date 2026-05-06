import { Router } from "express";
import controller from "../controllers/pmc.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createPMC);
router.put("/:id", controller.updatePMC);
router.delete("/:id", controller.deletePMC);
router.get("/:id", controller.getOne);
router.get("/", controller.getAll);
router.post("/get", controller.getPage);
router.post("/getCodes", controller.getCodes);

export default router;
