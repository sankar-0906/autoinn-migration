import express from "express";
import IdGenerateController from "../controllers/idGenerate.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/employee", async (req, res) => {
  try {
    const response = await IdGenerateController.employeeIdGenerate(req.body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/customer", async (req, res) => {
  try {
    const response = await IdGenerateController.customerIdGenerate(req.body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/quotation", async (req, res) => {
  try {
    const response = await IdGenerateController.quotationIdGenerate(null, req.body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/booking", async (req, res) => {
  try {
    const response = await IdGenerateController.bookingIdGenerate(req.body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/saleChallan", async (req, res) => {
  try {
    const response = await IdGenerateController.saleChallanIdGenerate(req.body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/saleInvoice", async (req, res) => {
  try {
    const response = await IdGenerateController.saleInvoiceIdGenerate(req.body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/jobOrder", async (req, res) => {
  try {
    const response = await IdGenerateController.jobOrderIdGenerate(null, req.body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/estimate", async (req, res) => {
  try {
    const response = await IdGenerateController.estimateIdGenerate(null, req.body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/activity", async (req, res) => {
  try {
    const response = await IdGenerateController.activity(req.body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/purchaseChallan", async (req, res) => {
  try {
    const response = await IdGenerateController.purchaseChallanIdGenerate(req.body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/purchaseInvoice", async (req, res) => {
  try {
    const response = await IdGenerateController.purchaseInvoiceIdGenerate(req.body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/saleSpareInvoice", async (req, res) => {
  try {
    const response = await IdGenerateController.saleSpareInvoiceIdGenerate(req.body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/jobInvoice", async (req, res) => {
  try {
    const response = await IdGenerateController.jobInvoiceIdGenerate(req.body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/purchaseSpareInvoice", async (req, res) => {
  try {
    const response = await IdGenerateController.purchaseSpareInvoiceIdGenerate(req.body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/enquiry", async (req, res) => {
  try {
    const response = await IdGenerateController.enquiryIdGenerate(req.body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/promotions", async (req, res) => {
  try {
    const response = await IdGenerateController.promotionsIdGenerate(req.body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

export default router;
