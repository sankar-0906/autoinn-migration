import { Router } from "express";
import controller from "../controllers/company.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createCompany);
router.get("/", controller.getAll);
router.get("/getOne/:id", controller.getOne);
router.put("/:id", controller.updateCompany);
router.delete("/:id", controller.deleteCompany);
router.get("/senderId", controller.senderId);

// Branch routes
router.get("/branches", controller.getBranches);
router.post("/branches", controller.createBranch);
router.put("/branches/:id", controller.updateBranch);
router.delete("/branches/:id", controller.delBranches);
router.post("/branches/get", controller.getPage);
router.delete("/branchContact/:id", controller.deleteBranchContact);
router.delete("/bank/:id", controller.delBank);
router.get("/getCompany/:branchId", controller.getCompanyByBranch);

export default router;
