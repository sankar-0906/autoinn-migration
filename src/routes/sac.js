import { Router } from "express";
import controller from "../controllers/sac.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(auth);

router.post("/", controller.createSac);
router.put("/:id", controller.updateSac);
router.delete("/:id", controller.deleteSac);
router.get("/:id", controller.getOne);
router.get("/", controller.getAll);
router.post("/get", controller.getPage);

export default router;
