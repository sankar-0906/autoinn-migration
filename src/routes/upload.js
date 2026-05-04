import { Router } from "express";

const router = Router();

router.post("/mocky", (req, res) => {
  try {
    const time = () => {
      res.json({
        code: 200,
        msg: "mocky",
      });
      clearTimeout(timeOut);
    };
    const timeOut = setTimeout(time, 2000);
  } catch (error) {
    res.json({ code: 500, msg: "An error occured" });
  }
});

export default router;
