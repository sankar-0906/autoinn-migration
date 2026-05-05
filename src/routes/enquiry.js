import { Router } from "express";
import controller from "../controllers/enquiry.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", controller.createEnquiry);
router.get("/:id", controller.getOne);
router.get("/getPhone/:id", controller.getByPhone);
router.get("/", (req, res) => res.json({ code: 200, response: [] })); // Placeholder for getAll
router.post("/get", controller.getPage);

export default router;
