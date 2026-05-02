import express from "express";
import PromotionsController from "../controllers/promotions.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/task", auth, async (req, res) => {
  try {
    const response = await PromotionsController.createTask(req.body, req.user.id);
    res.status(response.code).json(response);
  } catch (err) {
    res.status(err.code || 500).json(err);
  }
});

router.get("/task/getAll", auth, async (req, res) => {
  try {
    const response = await PromotionsController.getAllTasks();
    res.status(response.code).json(response);
  } catch (err) {
    res.status(err.code || 500).json(err);
  }
});

router.post("/group", auth, async (req, res) => {
  try {
    const response = await PromotionsController.createGroup(req.body, req.user.id);
    res.status(response.code).json(response);
  } catch (err) {
    res.status(err.code || 500).json(err);
  }
});

router.get("/group/getAll", auth, async (req, res) => {
  try {
    const response = await PromotionsController.getAllGroups();
    res.status(response.code).json(response);
  } catch (err) {
    res.status(err.code || 500).json(err);
  }
});

export default router;
