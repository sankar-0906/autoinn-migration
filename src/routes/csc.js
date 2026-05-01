import { Router } from "express";
import controller from "../controllers/csc.js";

const router = Router();

router.get("/country", controller.getCountry);
router.post("/states", controller.getStates);
router.post("/cities", controller.getCities);
router.post("/createCity", controller.createCity);

router.get("/", (req, res) => {
  res.json({ code: 200, msg: "Success !" });
});

export default router;
