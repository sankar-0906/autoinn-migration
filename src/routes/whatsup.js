import { Router } from "express";
import controller from "../controllers/whatsup.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.get("/", async (req, res) => {
  try {
    const response = await controller.getAll();
    res.status(response.code).json(response);
  } catch (err) {
    res.status(err.code || 500).json(err);
  }
});

router.get("/getChatList", async (req, res) => {
  try {
    const response = await controller.getChatList();
    res.status(response.code).json(response);
  } catch (err) {
    res.status(err.code || 500).json(err);
  }
});

router.get("/getChatMessage/:id", async (req, res) => {
  try {
    const response = await controller.getChatMessage(req.params.id);
    res.status(response.code).json(response);
  } catch (err) {
    res.status(err.code || 500).json(err);
  }
});

router.get("/profile", async (req, res) => {
  try {
    const response = await controller.fetchProfileByNumber();
    res.status(response.code).json(response);
  } catch (err) {
    res.status(err.code || 500).json(err);
  }
});

export default router;
