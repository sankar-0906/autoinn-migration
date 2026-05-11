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

  uploadVehicleDocument = async (file, body) => {
    try {
      if (!file) return { code: 400, message: "No file uploaded" };
      const location = `/uploads/${file.filename}`;
      const vehicleDoc = await prisma.vehicleDocument.create({
        data: {
          url: location,
          type: body.type,
          vehicle: { connect: { id: body.id } }
        }
      });
      return {
        code: 200,
        message: "Vehicle document uploaded successfully",
        data: vehicleDoc
      };
    } catch (err) {
      logger.error("uploadVehicleDocument error:", err);
      return { code: 500, message: "Error uploading vehicle document", data: err };
    }
  };

  uploadVehicleInsuranceDocument = async (file, body) => {
    try {
      if (!file) return { code: 400, message: "No file uploaded" };
      const location = `/uploads/${file.filename}`;
      // In legacy, this didn't necessarily create a DB record here, 
      // but returned the URL for the frontend to save.
      return {
        code: 200,
        message: "Vehicle insurance document uploaded successfully",
        data: { Location: location }
      };
    } catch (err) {
      logger.error("uploadVehicleInsuranceDocument error:", err);
      return { code: 500, message: "Error uploading insurance document", data: err };
    }
  };

  RemoveFile = async (body) => {
    try {
      const { url, delid } = body;
      if (delid) {
        await prisma.vehicleDocument.delete({
          where: { id: delid }
        });
      }
      return {
        code: 200,
        message: "File Deleted",
        data: { url, delid }
      };
    } catch (err) {
      logger.error("RemoveFile error:", err);
      return { code: 500, message: "Error deleting file", data: err };
    }
  };
}

export default new UploadController();
