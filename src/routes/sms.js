import express from "express";
import SmsController from "../controllers/sms.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", auth, async (req, res) => {
  try {
    const response = await SmsController.createSms(req.body, req.user.id);
    res.status(response.code).json(response);
  } catch (err) {
    res.status(err.code || 500).json(err);
  }
});

router.post("/report", async (req, res) => {
  try {
    const response = await SmsController.smsReport(req.body);
    res.status(response.code).json(response);
  } catch (err) {
    res.status(err.code || 500).json(err);
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const response = await SmsController.updateSms(req.params.id, req.body, req.user.id);
    res.status(response.code).json(response);
  } catch (err) {
    res.status(err.code || 500).json(err);
  }
});

router.delete("/:id/:type", auth, async (req, res) => {
  try {
    const response = await SmsController.deleteSms(req.params.id, req.params.type, req.user.id);
    res.status(response.code).json(response);
  } catch (err) {
    res.status(err.code || 500).json(err);
  }
});

router.get("/getAll", auth, async (req, res) => {
  try {
    const response = await SmsController.getAll();
    res.status(response.code).json(response);
  } catch (err) {
    res.status(err.code || 500).json(err);
  }
});

export default router;
