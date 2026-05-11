import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import uploadController from "../controllers/upload.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const profileUpload = upload.single("profile");
const anyUpload = upload.any();

router.post("/", auth, profileUpload, async (req, res) => {
  try {
    const file = req.file;
    const body = req.body;
    const response = await uploadController.uploadFile(file, body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/image", auth, profileUpload, async (req, res) => {
  try {
    const file = req.file;
    const body = req.body;
    const response = await uploadController.uploadImage(file, body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/file", auth, anyUpload, async (req, res) => {
  try {
    const { files, body } = req;
    const response = await uploadController.UploadFiles(files, body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/vehicle", auth, profileUpload, async (req, res) => {
  try {
    const file = req.file;
    const body = req.body;
    const response = await uploadController.uploadVehicleDocument(file, body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/vehicleInsurance", auth, profileUpload, async (req, res) => {
  try {
    const file = req.file;
    const body = req.body;
    const response = await uploadController.uploadVehicleInsuranceDocument(file, body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/deleteFile", auth, async (req, res) => {
  try {
    const { body } = req;
    const response = await uploadController.RemoveFile(body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

router.post("/get", auth, async (req, res) => {
  try {
    const { body } = req;
    const response = await uploadController.getFiles(body);
    res.json({ code: 200, response });
  } catch (err) {
    res.json({ code: 500, msg: "An error occured", err });
  }
});

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
