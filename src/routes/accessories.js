import { Router } from "express";
import accessoriesController from "../controllers/accessories.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", auth, async (req, res) => {
  try {
    const user = req.user.id;
    const { body } = req;
    const response = await accessoriesController.createAccessories(body, user);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const { params: { id }, body } = req;
    const user = req.user.id;
    const response = await accessoriesController.updateAccessories(id, body, user);
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
    const response = await accessoriesController.deleteAccessories(id, type, user);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { params: { id } } = req;
    const response = await accessoriesController.getOne(id);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, message: "Server error", err });
  }
});

router.get("/suit/:id", auth, async (req, res) => {
  try {
    const { params: { id } } = req;
    const user = req.user.id;
    const response = await accessoriesController.getSuited(id, user);
    res.json({ code: 200, response });
  } catch (error) {
    res.json({ code: 500, msg: "An error occured", err: error });
  }
});

router.get("/", async (req, res) => {
  try {
    const response = await accessoriesController.getAll();
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/get", async (req, res) => {
  try {
    const { body } = req;
    const response = await accessoriesController.getPage(body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "an error occurred", err });
  }
});

export default router;
