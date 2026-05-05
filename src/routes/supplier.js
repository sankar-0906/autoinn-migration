import { Router } from "express";
import controller from "../controllers/supplier.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware
router.use(auth);

router.post("/", async (req, res) => {
  try {
    const response = await controller.createSupplier(req);
    res.status(response.code).json(response);
  } catch (err) {
    res.status(err.code || 500).json(err);
  }
});

router.get("/:id", async (req, res) => {
  try {
    const response = await controller.getOne(req.params.id);
    res.status(response.code).json(response);
  } catch (err) {
    res.status(err.code || 500).json(err);
  }
});

router.get("/", async (req, res) => {
  try {
    const response = await controller.getAll();
    res.status(response.code).json(response);
  } catch (err) {
    res.status(err.code || 500).json(err);
  }
});

router.post("/get", async (req, res) => {
  try {
    const response = await controller.getPage(req);
    res.status(response.code).json(response);
  } catch (err) {
    res.status(err.code || 500).json(err);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const response = await controller.updateSupplier(req);
    res.status(response.code).json(response);
  } catch (err) {
    res.status(err.code || 500).json(err);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const response = await controller.deleteSupplier(req.params.id);
    res.status(response.code).json(response);
  } catch (err) {
    res.status(err.code || 500).json(err);
  }
});

router.delete("/phone/:id", async (req, res) => {
  try {
    const response = await controller.deletePhone(req.params.id);
    res.status(response.code).json(response);
  } catch (err) {
    res.status(err.code || 500).json(err);
  }
});

router.delete("/bank/:id", async (req, res) => {
  try {
    const response = await controller.deleteBank(req.params.id);
    res.status(response.code).json(response);
  } catch (err) {
    res.status(err.code || 500).json(err);
  }
});

export default router;
