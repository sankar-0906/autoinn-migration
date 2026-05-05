import { Router } from "express";
import controller from "../controllers/saleRegister.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/getAll", controller.getAllSaleRegisters);
router.get("/getOne/:id", controller.getOneSaleRegister);
router.put("/updateStatus/:id", controller.updateSaleRegisterStatus);

export default router;
