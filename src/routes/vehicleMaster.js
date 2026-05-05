import { Router } from "express";
import controller from "../controllers/vehicleMaster.js";
import { auth } from "../middlewares/auth.middleware.js";
import multer from "multer";
import fs from "fs";

const router = Router();

// Multer configuration for handling multipart/form-data
// Using memory storage for simplicity or you can use disk storage as in upload.js
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
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ 
  storage: storage,
  limits: { fieldSize: 104857600 } 
});

// Apply auth middleware
router.use(auth);

router.post("/", upload.any(), controller.createVehicleMaster);
router.put("/:id", upload.any(), controller.updateVehicleMaster);
router.delete("/:id", controller.deleteVehicleMaster);

router.get("/man/:id", controller.getModel);
router.get("/manAll/:id", controller.getAllModel);
router.get("/template", controller.template);
router.get("/data/export", controller.exportData);
router.get("/getOne/:id", controller.getOne);
router.get("/:id", controller.getOne);
router.get("/", controller.getAll);
router.post("/get", controller.getPage);

router.post("/deleteService", controller.deleteService);
router.delete("/file/:id", controller.deleteFile);
router.delete("/image/:id", controller.deleteImage);
router.post("/upload", upload.any(), controller.uploadFiles);

export default router;
