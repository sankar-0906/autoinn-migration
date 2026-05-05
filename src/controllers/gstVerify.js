import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import axios from "axios";

/**
 * Controller for GST Verification operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class GstVerifyController {
  gstVerify = async (req, res) => {
    try {
      const { gst } = req.body;
      
      const response = await axios.get("https://appyflow.in/api/verifyGST", {
        params: { 
          gstNo: gst, 
          key_secret: `DMJJGvzKdChGcugTVQJjH4yG65O2` 
        },
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "GST verified",
          data: { data: response.data }
        }
      });
    } catch (err) {
      logger.error("GST verification error:", err);
      return res.json({ 
        code: 500, 
        msg: "An error occured",
        error: err.response?.data || err.message 
      });
    }
  };
}

export default new GstVerifyController();
