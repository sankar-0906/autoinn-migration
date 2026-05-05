import path from "path";
import fs from "fs";
import logger from "../config/logger.config.js";

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

      // In the legacy project, it returns the URL of the uploaded image
      // Since we are using local storage, we return the relative path
      // The frontend might expect a full URL or a relative path starting with /uploads/
      
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
}

export default new UploadController();
