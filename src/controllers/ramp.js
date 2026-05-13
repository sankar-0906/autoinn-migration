import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import userController from "./user.js";

/**
 * Controller for Ramp operations.
 * Migrated from legacy project with Prisma 7 support.
 */
class RampController {
  
  /**
   * Helper to ensure ramps exist for a branch based on noOfRamps count
   */
  ensureRamps = async (branchId) => {
    try {
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { noOfRamps: true }
      });

      if (!branch) return;

      const total = branch.noOfRamps || 0;

      // Get existing ramps
      const existing = await prisma.ramp.findMany({
        where: { branch: branchId },
        orderBy: { rampNo: 'asc' }
      });

      // Delete ramps beyond total
      const toDelete = existing.filter(r => r.rampNo > total);
      if (toDelete.length > 0) {
        await prisma.ramp.deleteMany({
          where: { id: { in: toDelete.map(r => r.id) } }
        });
      }

      // Create missing ramps
      for (let i = 1; i <= total; i++) {
        const exists = existing.find(r => r.rampNo === i);
        if (!exists) {
          await prisma.ramp.create({
            data: {
              rampNo: i,
              branch: branchId,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
        }
      }
    } catch (err) {
      logger.error("Ensure ramps error:", err);
    }
  };

  /**
   * Get all ramps for a branch (or multiple branches)
   */
  getAllRamps = async (req, res) => {
    try {
      let branchIds = req.user?.branch; // From auth middleware
      if (!branchIds) return res.status(400).json({ code: 400, message: "Branch context missing" });
      
      if (!Array.isArray(branchIds)) branchIds = [branchIds];

      const results = [];

      for (const branchId of branchIds) {
        const branch = await prisma.branch.findUnique({
          where: { id: branchId },
          select: { id: true, name: true, noOfRamps: true }
        });

        if (!branch) continue;

        const total = branch.noOfRamps || 0;

        // Ensure ramps are synced
        await this.ensureRamps(branchId);

        const ramps = await prisma.ramp.findMany({
          where: { branch: branchId },
          include: {
            User: { // mechanic
              include: userController.userInclude
            },
            jobOrders: {
              where: {
                jobStatus: { not: "COMPLETED" }
              },
              include: {
                mechanic: {
                  include: userController.userInclude
                }
              }
            },
            Branch: {
              select: { id: true, name: true }
            }
          },
          orderBy: { rampNo: 'asc' }
        });

        // Format to match legacy expected structure
        const formattedRamps = ramps.map(r => {
          const job = r.jobOrders[0] || null;
          if (job && job.mechanic) {
            job.mechanic = userController.formatUser(job.mechanic);
          }
          
          return {
            id: r.id,
            rampNo: r.rampNo,
            branch: r.Branch,
            mechanic: userController.formatUser(r.User),
            job: job
          };
        });

        results.push({
          branchId,
          total,
          ramps: formattedRamps
        });
      }

      return res.json({ code: 200, response: results });
    } catch (err) {
      logger.error("Get all ramps error:", err);
      return res.status(500).json({ code: 500, message: "An error occurred" });
    }
  };

  /**
   * Assign a job order to a ramp
   */
  assignJobToRamp = async (req, res) => {
    try {
      const { rampId, jobOrderId } = req.body;

      if (!rampId || !jobOrderId) {
        return res.status(400).json({ code: 400, message: "Ramp ID and Job Order ID are required" });
      }

      const ramp = await prisma.ramp.findUnique({ where: { id: rampId } });
      if (!ramp) return res.status(404).json({ code: 404, message: "Ramp not found" });

      const job = await prisma.jobOrder.findUnique({ where: { id: jobOrderId } });
      if (!job) return res.status(404).json({ code: 404, message: "Job order not found" });

      // In Prisma 7, we update the job order to point to the ramp
      await prisma.jobOrder.update({
        where: { id: jobOrderId },
        data: {
          rampId: rampId
        }
      });

      // Fetch the updated ramp with relations to return to frontend
      const updatedRamp = await prisma.ramp.findUnique({
        where: { id: rampId },
        include: {
          User: { include: userController.userInclude },
          jobOrders: {
            where: { jobStatus: { not: "COMPLETED" } },
            include: {
              mechanic: { include: userController.userInclude }
            }
          },
          Branch: { select: { id: true, name: true } }
        }
      });

      const formatted = {
        id: updatedRamp.id,
        rampNo: updatedRamp.rampNo,
        branch: updatedRamp.Branch,
        mechanic: userController.formatUser(updatedRamp.User),
        job: updatedRamp.jobOrders[0] || null
      };
      
      if (formatted.job && formatted.job.mechanic) {
        formatted.job.mechanic = userController.formatUser(formatted.job.mechanic);
      }

      return res.json({ code: 200, message: "Job assigned to ramp", data: formatted });
    } catch (err) {
      logger.error("Assign job to ramp error:", err);
      return res.status(500).json({ code: 500, message: "An error occurred" });
    }
  };

  /**
   * Assign a mechanic to a ramp
   */
  assignMechanicToRamp = async (req, res) => {
    try {
      const { rampId, mechanicId } = req.body;

      if (!rampId || !mechanicId) {
        return res.status(400).json({ code: 400, message: "Ramp ID and Mechanic ID are required" });
      }

      const ramp = await prisma.ramp.findUnique({ where: { id: rampId } });
      if (!ramp) return res.status(404).json({ code: 404, message: "Ramp not found" });

      const mech = await prisma.user.findUnique({ where: { id: mechanicId } });
      if (!mech) return res.status(404).json({ code: 404, message: "Mechanic not found" });

      await prisma.ramp.update({
        where: { id: rampId },
        data: {
          mechanic: mechanicId
        }
      });

      // Fetch the updated ramp with relations to return to frontend
      const updatedRamp = await prisma.ramp.findUnique({
        where: { id: rampId },
        include: {
          User: { include: userController.userInclude },
          jobOrders: {
            where: { jobStatus: { not: "COMPLETED" } },
            include: {
              mechanic: { include: userController.userInclude }
            }
          },
          Branch: { select: { id: true, name: true } }
        }
      });

      const formatted = {
        id: updatedRamp.id,
        rampNo: updatedRamp.rampNo,
        branch: updatedRamp.Branch,
        mechanic: userController.formatUser(updatedRamp.User),
        job: updatedRamp.jobOrders[0] || null
      };

      if (formatted.job && formatted.job.mechanic) {
        formatted.job.mechanic = userController.formatUser(formatted.job.mechanic);
      }

      return res.json({ code: 200, message: "Mechanic assigned to ramp", data: formatted });
    } catch (err) {
      logger.error("Assign mechanic to ramp error:", err);
      return res.status(500).json({ code: 500, message: "An error occurred" });
    }
  };

  /**
   * Clear a ramp (disconnect job orders)
   */
  clearRamp = async (req, res) => {
    try {
      const { rampId } = req.params;

      const ramp = await prisma.ramp.findUnique({
        where: { id: rampId },
        include: { jobOrders: true }
      });

      if (!ramp) return res.status(404).json({ code: 404, message: "Ramp not found" });

      if (ramp.jobOrders.length === 0) {
        return res.json({ code: 200, message: "Ramp already clear", data: ramp });
      }

      // Disconnect all job orders from this ramp
      await prisma.jobOrder.updateMany({
        where: { rampId: rampId },
        data: { rampId: null }
      });

      const updated = await prisma.ramp.findUnique({ where: { id: rampId } });

      return res.json({ code: 200, message: "Ramp cleared", data: updated });
    } catch (err) {
      logger.error("Clear ramp error:", err);
      return res.status(500).json({ code: 500, message: "An error occurred" });
    }
  };
}

export default new RampController();
