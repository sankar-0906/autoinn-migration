import path from "path";
import fs from "fs";
import logger from "../config/logger.config.js";
import prisma from "../config/prisma.config.js";

class UploadController {
  constructor() {}

  uploadImage = async (file, body) => {
    try {
      if (!file) {
        return {
          code: 400,
          message: "No file uploaded"
        };
      }

      const location = `/uploads/${file.filename}`;

      return {
        code: 200,
        message: "Image uploaded",
        data: {
          Location: location,
          filename: file.filename
        }
      };
    } catch (err) {
      logger.error("Upload image error:", err);
      return {
        code: 500,
        message: "Error uploading image",
        data: err
      };
    }
  };

  uploadFile = async (file, body) => {
    try {
      if (!file) {
        return {
          code: 400,
          message: "No file uploaded"
        };
      }

      const location = `/uploads/${file.filename}`;

      return {
        code: 200,
        message: "File uploaded",
        data: {
          Location: location,
          filename: file.filename
        }
      };
    } catch (err) {
      logger.error("Upload file error:", err);
      return {
        code: 500,
        message: "Error uploading file",
        data: err
      };
    }
  };

  UploadFiles = async (files, body) => {
    try {
      const { fileName, module } = body;
      let url = "";

      if (Array.isArray(files)) {
        for (const file of files) {
          const res = await this.uploadFile(file, body);
          url = res.data.Location;
        }
      } else if (files) {
        // Handle single file or field-based files from multer
        const res = await this.uploadFile(files[0] || files, body);
        url = res.data.Location;
      }

      const fileManagement = await prisma.fileManagement.create({
        data: {
          name: fileName,
          module,
          url,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return { msg: "file Uploaded", url, data: fileManagement };
    } catch (error) {
      logger.error("UploadFiles error:", error);
      throw error;
    }
  };

  getFiles = async (body) => {
    try {
      const fileManagement = await prisma.fileManagement.findMany({
        orderBy: { createdAt: "desc" }
      });
      return {
        code: 200,
        msg: "All Files fetched",
        data: fileManagement,
      };
    } catch (error) {
      logger.error("getFiles error:", error);
      throw error;
    }
  };
}

export default new UploadController();
