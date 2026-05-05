import { Router } from "express";
import departmentController from "../controllers/department.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", auth, async (req, res) => {
  try {
    const user = req.user.id;
    const { body } = req;
    const response = await departmentController.createDepartment(body, user);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err: err });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const { params: { id }, body } = req;
    const user = req.user.id;
    const branch = req.user.branch;
    const response = await departmentController.updateDepartment(id, body, user, branch);
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
    const response = await departmentController.deleteDepartment(id, type, user);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const { params: { id } } = req;
    const user = req.user.id;
    const branch = req.user.branch;
    const response = await departmentController.getDepartment({ id }, user, branch);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, message: "Server error, Please check the logs", err });
  }
});

router.get("/", auth, async (req, res) => {
  try {
    const user = req.user.id;
    const response = await departmentController.getAll(user);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/get", auth, async (req, res) => {
  try {
    const { body } = req;
    const branch = req.user.branch;
    const response = await departmentController.getPage(body, branch);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "an error occurred", err });
  }
});

router.post("/getUser", auth, async (req, res) => {
  try {
    const { body } = req;
    const user = req.user.id;
    const branch = req.user.branch;
    const response = await departmentController.getDepartment(body, user, branch);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, message: "Server error, Please check the logs", err });
  }
});

router.delete("/roleAccess/:id", auth, async (req, res) => {
  try {
    const { params: { id } } = req;
    const user = req.user.id;
    const type = "HARD";
    const response = await departmentController.deleteRoleAccess(id, type, user);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

export default router;
