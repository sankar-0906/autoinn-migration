import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";

/**
 * Controller for Material Issue (Parts issued to Job Orders).
 */
class MaterialIssueController {
  getPage = async (req, res) => {
    try {
      const { page = 1, size = 10 } = req.body;
      const skip = (parseInt(page) - 1) * parseInt(size);
      const take = parseInt(size);

      const [materials, count] = await Promise.all([
        prisma.materialIssue.findMany({
          skip,
          take,
          include: {
            job: {
              include: {
                customer: { select: { name: true } },
                vehicle: { select: { registerNo: true } }
              }
            },
            mechanic: { select: { EmployeeProfile_User_profileToEmployeeProfile: { select: { employeeName: true } } } },
            MaterialPartsIssue: {
              include: { part: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.materialIssue.count()
      ]);

      return res.json({
        code: 200,
        response: { count, materials }
      });
    } catch (err) {
      logger.error("Material issue getPage error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const material = await prisma.materialIssue.findUnique({
        where: { id },
        include: {
          job: true,
          MaterialPartsIssue: {
            include: { part: true }
          }
        }
      });
      return res.json({
        code: 200,
        response: material
      });
    } catch (err) {
      logger.error("Material issue getOne error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getMaxSlipNumber = async (req, res) => {
    try {
      const { materialIssueId } = req.params;
      const result = await prisma.materialPartsIssue.aggregate({
        where: {
          MaterialIssue: { some: { id: materialIssueId } }
        },
        _max: {
          slipNumber: true
        }
      });
      return res.json({
        code: 200,
        response: result._max.slipNumber || 0
      });
    } catch (err) {
      logger.error("Material issue getMaxSlipNumber error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };
}

export default new MaterialIssueController();
