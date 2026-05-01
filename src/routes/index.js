import { Router } from "express";
import cscRoutes from "./csc.js";
import hsnRoutes from "./hsn.js";
import sacRoutes from "./sac.js";

const router = Router();

router.use("/csc", cscRoutes);
router.use("/hsn", hsnRoutes);
router.use("/sac", sacRoutes);

export default router;
