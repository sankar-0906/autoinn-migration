import { Router } from "express";
import controller from "../controllers/company.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createCompany);
router.get("/", controller.getAll);
router.get("/getOne/:id", controller.getOne);

// Branch routes
router.get("/branches", controller.getBranches);
router.post("/branches", controller.createBranch);
router.post("/branches/get", controller.getPage);
router.get("/getCompany/:branchId", controller.getCompanyByBranch);

export default router;
