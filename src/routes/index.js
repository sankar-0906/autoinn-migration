import { Router } from "express";
import cscRoutes from "./csc.js";
import hsnRoutes from "./hsn.js";
import sacRoutes from "./sac.js";
import rtoRoutes from "./rto.js";
import userRoutes from "./user.js";
import companyRoutes from "./company.js";

const router = Router();

router.use("/csc", cscRoutes);
router.use("/hsn", hsnRoutes);
router.use("/sac", sacRoutes);
router.use("/rto", rtoRoutes);
router.use("/user", userRoutes);
router.use("/company", companyRoutes);

export default router;
