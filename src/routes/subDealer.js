import { Router } from "express";
import subDealerController from "../controllers/subDealer.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", auth, async (req, res) => {
  try {
    const user = req.user.id;
    const { body } = req;
    const response = await subDealerController.createSubDealer(body, user);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const { params: { id }, body } = req;
    const user = req.user.id;
    const response = await subDealerController.updateSubDealer(id, { ...body, user });
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.delete("/phone/:id", auth, async (req, res) => {
  try {
    const { params: { id } } = req;
    const response = await subDealerController.deletePhone(id);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.delete("/bank/:id", auth, async (req, res) => {
  try {
    const { params: { id } } = req;
    const response = await subDealerController.deleteBank(id);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const { params: { id } } = req;
    const user = req.user.id;
    const type = "HARD";
    const response = await subDealerController.deleteSubDealer(id, type, user);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { params: { id } } = req;
    const response = await subDealerController.getOne(id);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, message: "Server error", err });
  }
});

router.get("/", async (req, res) => {
  try {
    const response = await subDealerController.getAll();
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/get", async (req, res) => {
  try {
    const { body } = req;
    const response = await subDealerController.getPage(body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "an error occurred", err });
  }
});

export default router;
