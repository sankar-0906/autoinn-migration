import express from "express";
import controller from "../controllers/payment.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/create", auth, async (req, res) => {
  try {
    const user = req.user.id;
    const response = await controller.createPaymentPending(req.body, user);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occurred", err });
  }
});

router.post("/update", auth, async (req, res) => {
  try {
    const user = req.user.id;
    const response = await controller.updatePayment(req.body, user);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occurred", err });
  }
});

router.post("/initiateCard", auth, async (req, res) => {
  try {
    const user = req.user.id;
    const { paymentId, amount, branchId, paymentMode, billAmount, mode } = req.body;
    if (!paymentId || !amount || !branchId) {
      return res.json({ code: 400, msg: "Missing required fields" });
    }
    const response = await controller.initiateCardPayment({ 
      paymentId, amount, branchId, userId: user, paymentMode, billAmount, mode 
    });
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: err.code || 500, msg: "An error occurred", err: err.message || err });
  }
});

router.get("/cardStatus/:plutusTransactionId", auth, async (req, res) => {
  try {
    const { plutusTransactionId } = req.params;
    const userId = req.user.id;
    const response = await controller.getCardStatus(plutusTransactionId, userId);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: err.code || 500, msg: "An error occurred", err: err.message || err });
  }
});

export default router;
