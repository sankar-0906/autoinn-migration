import { Router } from "express";
import controller from "../controllers/customer.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Digital lead might be called from external sources without auth, 
// but for now following reference structure which usually applies auth to the whole router
router.use(auth);

router.post("/", controller.createCustomer);
router.get("/:id", controller.getOne);
router.get("/phone/:id", controller.getByPhone);
router.get("/", (req, res) => res.json({ code: 200, response: [] })); // Placeholder for getAll
router.post("/get", controller.getPage);
router.post("/digitalLead", controller.digitalLeads);

export default router;
