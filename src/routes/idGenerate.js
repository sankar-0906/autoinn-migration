import express from "express";
import IdGenerateController from "../controllers/idGenerate.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/employee", auth, async (req, res) => {
  try {
    const response = await IdGenerateController.employeeIdGenerate(req.body, req.user.id);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/customer", auth, async (req, res) => {
  try {
    const response = await IdGenerateController.customerIdGenerate(req.body, req.user.id);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/quotation", auth, async (req, res) => {
  try {
    const response = await IdGenerateController.quotationIdGenerate(req.user.branch, req.body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/booking", auth, async (req, res) => {
  try {
    const response = await IdGenerateController.bookingIdGenerate(req.body, req.user.id);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/saleChallan", auth, async (req, res) => {
  try {
    const response = await IdGenerateController.saleChallanIdGenerate(req.body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/saleInvoice", auth, async (req, res) => {
  try {
    const response = await IdGenerateController.saleInvoiceIdGenerate(req.body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/jobOrder", auth, async (req, res) => {
  try {
    const response = await IdGenerateController.jobOrderIdGenerate(req.user.branch, req.body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/estimate", auth, async (req, res) => {
  try {
    const response = await IdGenerateController.estimateIdGenerate(req.user.branch, req.body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/activity", auth, async (req, res) => {
  try {
    const response = await IdGenerateController.activity(req.body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

export default router;
