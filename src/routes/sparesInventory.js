import { Router } from "express";
import controller from "../controllers/sparesInventory.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createSparesInventory);
router.put("/:id", controller.updateSparesInventory);
router.delete("/:id", controller.deleteSparesInventory);
router.get("/getSpares/:id", controller.getSparePart);
router.get("/getSparesHistory/:id", controller.getSparesHistory);
router.post("/getAllByBranch", controller.getAllByBranch);
router.post("/branch/get", controller.getByBranch);
router.post("/bulkUpdate", controller.bulkUpdate);
router.post("/getPart", controller.getPart);
router.get("/branch/all", controller.getAllBranch);
router.get("/:id", controller.getOne);
router.post("/get", controller.getPage);
router.get("/", controller.getAll);

export default router;
