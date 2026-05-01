import { Router } from "express";
import controller from "../controllers/hsn.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(auth);

router.post("/", controller.createHsn);
router.put("/:id", controller.updateHsn);
router.delete("/:id", controller.deleteHsn);
router.get("/:id", controller.getOne);
router.get("/", controller.getAll);
router.post("/get", controller.getPage);

export default router;
