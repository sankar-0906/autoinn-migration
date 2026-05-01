import { Router } from "express";
import cscRoutes from "./csc.js";
import hsnRoutes from "./hsn.js";
import sacRoutes from "./sac.js";
import rtoRoutes from "./rto.js";
import userRoutes from "./user.js";
import companyRoutes from "./company.js";
import manufacturerRoutes from "./manufacturer.js";
import financerRoutes from "./financer.js";
import vehicleMasterRoutes from "./vehicleMaster.js";
import customerRoutes from "./customer.js";
import enquiryRoutes from "./enquiry.js";

const router = Router();

router.use("/csc", cscRoutes);
router.use("/hsn", hsnRoutes);
router.use("/sac", sacRoutes);
router.use("/rto", rtoRoutes);
router.use("/user", userRoutes);
router.use("/company", companyRoutes);
router.use("/manufacturer", manufacturerRoutes);
router.use("/financer", financerRoutes);
router.use("/vehicleMaster", vehicleMasterRoutes);
router.use("/customer", customerRoutes);
router.use("/enquiry", enquiryRoutes);

export default router;
