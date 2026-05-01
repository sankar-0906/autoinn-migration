import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";

/**
 * Controller for Country, State, and City operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class cscController {
  getCountry = async (req, res) => {
    try {
      const country = await prisma.country.findMany({
        where: { name: "India" }
      });
      
      if (country && country.length > 0) {
        return res.json({
          code: 200,
          message: "countries fetched",
          data: country,
        });
      }
      
      return res.json({
        code: 404,
        message: "requested record not found",
        data: null,
      });
    } catch (err) {
      logger.error("Error fetching country:", err);
      return res.json({
        code: 500,
        message: "error fetching country",
        data: err.message,
      });
    }
  };

  getStates = async (req, res) => {
    try {
      const { id } = req.body;
      const state = await prisma.state.findMany({
        where: { country: id }
      });

      if (state) {
        return res.json({
          code: 200,
          message: "states fetched",
          data: state,
        });
      }

      return res.json({
        code: 404,
        message: "requested record not found",
        data: null,
      });
    } catch (err) {
      logger.error("Error fetching states:", err);
      return res.json({
        code: 500,
        message: "error fetching states",
        data: err.message,
      });
    }
  };

  getCities = async (req, res) => {
    try {
      const { id } = req.body;
      const city = await prisma.city.findMany({
        where: { state: id }
      });

      if (city) {
        return res.json({
          code: 200,
          message: "cities fetched",
          data: city,
        });
      }

      return res.json({
        code: 404,
        message: "requested record not found",
        data: null,
      });
    } catch (err) {
      logger.error("Error fetching cities:", err);
      return res.json({
        code: 500,
        message: "error fetching cities",
        data: err.message,
      });
    }
  };

  createCity = async (req, res) => {
    try {
      const { name, state } = req.body;
      const city = await prisma.city.create({
        data: {
          name,
          state: state,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      });

      if (city) {
        return res.json({
          code: 200,
          message: "cities created",
          data: city,
        });
      }
    } catch (err) {
      logger.error("Error creating city:", err);
      return res.json({
        code: 500,
        message: "error fetching cities",
        data: err.message,
      });
    }
  };
}

export default new cscController();
