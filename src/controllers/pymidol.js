import { fetchMarketInfo } from "../services/pymidolScraper.js";
import logger from "../config/logger.config.js";

class PymidolController {
  getMarketInfo = async (req, res) => {
    try {
      const { chassisNo } = req.body;
      logger.info(`Fetching market info for chassis: ${chassisNo}`);

      if (!chassisNo) {
        return res.status(400).json({ error: "chassisNo required" });
      }

      const data = await fetchMarketInfo(chassisNo);
      if (!data) {
        return res.status(502).json({ error: "No data returned from Pymidol" });
      }

      return res.json(data);
    } catch (err) {
      logger.error("Pymidol controller error:", err);
      return res.status(500).json({ 
        error: "Scraping failed", 
        details: err.message 
      });
    }
  };

  // Placeholder for other Pymidol methods if needed (e.g., push)
  pushToPymidol = async (req, res) => {
    return res.status(501).json({ message: "Push to Pymidol not implemented yet" });
  };
}

export default new PymidolController();
