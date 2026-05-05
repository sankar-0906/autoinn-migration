import express from "express";
import SendSmsController from "../controllers/sendSms.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/quotation", auth, async (req, res) => {
  try {
    const response = await SendSmsController.quotationSms(req.body, req.user.id, req.user.branch);
    res.status(response.code).json(response);
  } catch (err) {
    res.status(err.code || 500).json(err);
  }
});

router.post("/test", auth, async (req, res) => {
  try {
    const response = await SendSmsController.testSms(req.body);
    res.status(response.code).json(response);
  } catch (err) {
    res.status(err.code || 500).json(err);
  }
});

export default router;
