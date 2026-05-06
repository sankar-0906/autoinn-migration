import { Router } from "express";
import pineLabsController from "../controllers/pineLabs.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/create", auth, async (req, res) => {
  try {
    const payload = req.body;
    const response = await pineLabsController.create(payload);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occurred", err });
  }
});

router.post("/get", auth, async (req, res) => {
  try {
    const { searchString = "", page = 1, size = 10 } = req.body;
    const response = await pineLabsController.getAll({ searchString, page, size });
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occurred", err });
  }
});

router.put("/update/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;
    const response = await pineLabsController.update(id, payload);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occurred", err });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const response = await pineLabsController.delete(id);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occurred", err });
  }
});

export default router;
