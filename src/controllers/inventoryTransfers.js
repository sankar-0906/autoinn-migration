import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import { nanoid } from "nanoid";

/**
 * Controller for Inventory Transfers (Vehicles & Spares).
 * Ported from legacy with Prisma 7 and payload parity.
 */
class InventoryTransfersController {
  
  check = async (req, res) => {
    return res.json({ message: "INVENTORY TRANSFERS ENDPOINT" });
  };

  /**
   * Get vehicles available for transfer at a branch
   */
  getVehicles = async (req, res) => {
    try {
      const { branch } = req.body;
      if (!branch) return res.status(400).json({ code: 400, message: "Branch ID is required" });

      const inventory = await prisma.vehicleInventory.findMany({
        where: { branchId: branch },
        select: { vehicleId: true },
        distinct: ['vehicleId']
      });

      const vehicleIds = inventory.map(i => i.vehicleId);

      const vehicles = await prisma.vehicleMaster.findMany({
        where: { id: { in: vehicleIds } },
        include: { image: true }
      });

      const formatted = vehicles.map(v => ({
        vehicle: v.id,
        modelName: v.modelName,
        modelCode: v.modelCode,
        category: v.category,
        color: v.image || []
      }));

      return res.json({ code: 200, data: formatted });
    } catch (err) {
      logger.error("Get vehicles for transfer error:", err);
      return res.status(500).json({ code: 500, message: "An error occurred" });
    }
  };

  /**
   * Get colors for a specific vehicle at a branch
   */
  getVehiclesColors = async (req, res) => {
    try {
      const { branch, vehicle } = req.body;
      
      const inventory = await prisma.vehicleInventory.findMany({
        where: {
          branchId: branch,
          vehicleId: vehicle
        },
        include: { color: true },
        distinct: ['colorId']
      });

      const formatted = inventory.map(i => ({
        color: i.colorId,
        color_id: i.color?.id,
        url: i.color?.url,
        code: i.color?.code,
        vehicle: i.vehicleId
      }));

      return res.json({ code: 200, data: formatted });
    } catch (err) {
      logger.error("Get vehicle colors for transfer error:", err);
      return res.status(500).json({ code: 500, message: "An error occurred" });
    }
  };

  /**
   * Get chassis numbers for a specific vehicle at a branch
   */
  getVehiclesChassisNumbers = async (req, res) => {
    try {
      const { branch, vehicle } = req.body;
      
      const inventory = await prisma.vehicleInventory.findMany({
        where: {
          branchId: branch,
          vehicleId: vehicle
        }
      });

      const formatted = inventory.map(i => ({
        vehicleInventory: i.id,
        chassisNumber: i.chassisNo,
        color: i.colorId
      }));

      return res.json({ code: 200, data: formatted });
    } catch (err) {
      logger.error("Get chassis numbers for transfer error:", err);
      return res.status(500).json({ code: 500, message: "An error occurred" });
    }
  };

  /**
   * Perform vehicle transfer between branches
   */
  transferVehicles = async (req, res) => {
    try {
      const { from_branch, to_branch, vehicles } = req.body; // vehicles is an array of Inventory IDs

      if (!from_branch || !to_branch || !vehicles || !Array.isArray(vehicles)) {
        return res.status(400).json({ success: false, message: "Invalid payload" });
      }

      const result = await prisma.$transaction(async (tx) => {
        // 1. Get details of vehicles before updating
        const vehicleDetails = await tx.vehicleInventory.findMany({
          where: { id: { in: vehicles } },
          include: {
            vehicle: true,
            color: true
          }
        });

        // 2. Update branch in VehicleInventory
        const updateResult = await tx.vehicleInventory.updateMany({
          where: { id: { in: vehicles } },
          data: { branchId: to_branch }
        });

        if (updateResult.count > 0) {
          const now = new Date();
          const transferLogs = vehicleDetails.map(v => ({
            id: nanoid(20),
            createdAt: now,
            fromBranch: from_branch,
            toBranch: to_branch,
            vehicleInventory: v.id,
            chassisNo: v.chassisNo,
            modelName: v.vehicle?.modelName,
            modelCode: v.vehicle?.modelCode,
            category: v.vehicle?.category,
            colorId: v.colorId,
            colorCode: v.color?.code
          }));

          // 3. Create transfer records
          await tx.vehicleInventoryTransfer.createMany({
            data: transferLogs
          });

          return { success: true, count: updateResult.count };
        }
        return { success: false, message: "No records updated" };
      });

      return res.status(result.success ? 200 : 400).json({
        code: result.success ? 200 : 400,
        data: {
          success: result.success,
          message: result.success ? `${result.count} vehicles transferred successfully.` : result.message
        }
      });
    } catch (err) {
      logger.error("Transfer vehicles error:", err);
      return res.status(500).json({ code: 500, message: "Internal server error", error: err.message });
    }
  };

  /**
   * Get spares available for transfer at a branch
   */
  getSpares = async (req, res) => {
    try {
      const { branch, inputValue } = req.body;
      
      const spares = await prisma.sparesInventory.findMany({
        where: {
          branchId: branch,
          phyQuantity: { gt: 0 },
          partNo: inputValue ? {
            partNumber: { contains: inputValue, mode: 'insensitive' }
          } : undefined
        },
        include: { partNo: true }
      });

      const formatted = spares.map(s => ({
        partNumber: s.partNo?.partNumber,
        partName: s.partNo?.partName,
        phyQuantity: s.phyQuantity,
        partNo: s.partId
      }));

      return res.json({ code: 200, data: formatted });
    } catch (err) {
      logger.error("Get spares for transfer error:", err);
      return res.status(500).json({ code: 500, message: "An error occurred" });
    }
  };

  /**
   * Perform spares transfer between branches
   */
  transferSpares = async (req, res) => {
    try {
      const { from_branch, to_branch, spares } = req.body; // spares: [{partNo, quantity}]

      if (!from_branch || !to_branch || !spares || !Array.isArray(spares)) {
        return res.status(400).json({ success: false, message: "Invalid payload" });
      }

      await prisma.$transaction(async (tx) => {
        const now = new Date();

        for (const spare of spares) {
          const { partNo, quantity } = spare;

          // 1. Check stock in fromBranch
          const sourceStock = await tx.sparesInventory.findFirst({
            where: { partId: partNo, branchId: from_branch }
          });

          if (!sourceStock || sourceStock.phyQuantity < quantity) {
            throw new Error(`Insufficient stock for part ${partNo} at source branch`);
          }

          // 2. Reduce stock at source
          await tx.sparesInventory.update({
            where: { id: sourceStock.id },
            data: {
              accQuantity: { decrement: quantity },
              phyQuantity: { decrement: quantity }
            }
          });

          // 3. Increase stock at destination (upsert)
          const destStock = await tx.sparesInventory.findFirst({
            where: { partId: partNo, branchId: to_branch }
          });

          if (destStock) {
            await tx.sparesInventory.update({
              where: { id: destStock.id },
              data: {
                accQuantity: { increment: quantity },
                phyQuantity: { increment: quantity }
              }
            });
          } else {
            await tx.sparesInventory.create({
              data: {
                id: nanoid(20),
                partId: partNo,
                branchId: to_branch,
                accQuantity: quantity,
                phyQuantity: quantity,
                createdAt: now
              }
            });
          }

          // 4. Log transfer records in Transactions table for History
          // Source Branch Reduction
          await tx.transactions.create({
            data: {
              createdAt: now,
              type: "Transfer Out",
              Quantity: parseInt(quantity),
              status: "SUB",
              color: "red",
              Part: { connect: { id: partNo } },
              branch: { connect: { id: from_branch } },
              physicalQuantity: parseInt(quantity),
              accountQuantity: parseInt(quantity)
            }
          });

          // Destination Branch Increase
          await tx.transactions.create({
            data: {
              createdAt: now,
              type: "Transfer In",
              Quantity: parseInt(quantity),
              status: "ADD",
              color: "green",
              Part: { connect: { id: partNo } },
              branch: { connect: { id: to_branch } },
              physicalQuantity: parseInt(quantity),
              accountQuantity: parseInt(quantity)
            }
          });

          // 5. Log transfer in transfer history table
          await tx.spareInventoryTransfer.create({
            data: {
              id: nanoid(20),
              createdAt: now,
              quantity: quantity,
              fromBranch: from_branch,
              toBranch: to_branch,
              spareInventory: sourceStock.id
            }
          });
        }
      });

      return res.json({ 
        code: 200, 
        data: { success: true, message: "Spares transferred successfully!" } 
      });
    } catch (err) {
      logger.error("Transfer spares error:", err);
      return res.status(400).json({ code: 400, success: false, message: err.message });
    }
  };

  /**
   * Get vehicle transfer history
   */
  getVehicleTransferRecords = async (req, res) => {
    try {
      const { fromBranch, toBranch, startDate, endDate, searchString = "", page = 1, size = 10, branch } = req.body;
      const skip = (page - 1) * size;

      let branchIds = [];
      if (branch) {
        branchIds = Array.isArray(branch) ? branch : [branch];
      }

      const where = {
        AND: [
          branchIds.length > 0 ? {
            OR: [
              { fromBranch: { in: branchIds } },
              { toBranch: { in: branchIds } }
            ]
          } : {},
          {
            fromBranch: fromBranch || undefined,
            toBranch: toBranch || undefined,
            createdAt: (startDate || endDate) ? {
              gte: startDate ? new Date(startDate) : undefined,
              lte: endDate ? new Date(endDate) : undefined
            } : undefined,
            OR: searchString ? [
              { modelName: { contains: searchString, mode: 'insensitive' } },
              { modelCode: { contains: searchString, mode: 'insensitive' } },
              { chassisNo: { contains: searchString, mode: 'insensitive' } }
            ] : undefined
          }
        ]
      };

      const [records, count] = await Promise.all([
        prisma.vehicleInventoryTransfer.findMany({
          where,
          include: {
            Branch_VehicleInventoryTransfer_fromBranchToBranch: true,
            Branch_VehicleInventoryTransfer_toBranchToBranch: true,
            // Fetch color details directly from transfer record's colorId
            // We need to define this relation in schema or do a separate fetch if not defined
            // Wait, let's check schema for relation on colorId in VehicleInventoryTransfer
          },
          take: size,
          skip,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.vehicleInventoryTransfer.count({ where })
      ]);

      // Since there might not be a direct relation from VehicleInventoryTransfer to Image in schema,
      // let's fetch the images for the colorIds found in records.
      const colorIds = [...new Set(records.map(r => r.colorId).filter(Boolean))];
      const images = await prisma.image.findMany({
        where: { id: { in: colorIds } }
      });
      const imageMap = Object.fromEntries(images.map(img => [img.id, img]));

      const formatted = records.map(r => {
        const colorObj = imageMap[r.colorId];
        return {
          id: r.id,
          createdAt: r.createdAt,
          fromBranch: r.fromBranch,
          toBranch: r.toBranch,
          vehicleInventory: r.vehicleInventory,
          fromBranchName: r.Branch_VehicleInventoryTransfer_fromBranchToBranch?.name,
          toBranchName: r.Branch_VehicleInventoryTransfer_toBranchToBranch?.name,
          chassisNo: r.chassisNo,
          modelName: r.modelName,
          modelCode: r.modelCode,
          category: r.category,
          colorId: r.colorId,
          colorCode: r.colorCode,
          color: colorObj?.color || "N/A",
          colorUrl: colorObj?.url || "",
          transferStatus: r.vehicleInventory ? "Active" : "Completed",
          hasCurrentData: !!r.vehicleInventory
        };
      });

      return res.json({ code: 200, count, data: formatted });
    } catch (err) {
      logger.error("Get vehicle transfer history error:", err);
      return res.status(500).json({ code: 500, message: "Error fetching history" });
    }
  };

  /**
   * Get spares transfer history
   */
  getSpareTransferRecords = async (req, res) => {
    try {
      const { fromBranch, toBranch, startDate, endDate, searchString = "", page = 1, size = 10, branch } = req.body;
      const skip = (page - 1) * size;

      let branchIds = [];
      if (branch) {
        branchIds = Array.isArray(branch) ? branch : [branch];
      }

      const where = {
        AND: [
          branchIds.length > 0 ? {
            OR: [
              { fromBranch: { in: branchIds } },
              { toBranch: { in: branchIds } }
            ]
          } : {},
          {
            fromBranch: fromBranch || undefined,
            toBranch: toBranch || undefined,
            createdAt: (startDate || endDate) ? {
              gte: startDate ? new Date(startDate) : undefined,
              lte: endDate ? new Date(endDate) : undefined
            } : undefined,
            SparesInventory: searchString ? {
              partNo: {
                OR: [
                  { partName: { contains: searchString, mode: 'insensitive' } },
                  { partNumber: { contains: searchString, mode: 'insensitive' } }
                ]
              }
            } : undefined
          }
        ]
      };

      const [records, count] = await Promise.all([
        prisma.spareInventoryTransfer.findMany({
          where,
          include: {
            Branch_SpareInventoryTransfer_fromBranchToBranch: true,
            Branch_SpareInventoryTransfer_toBranchToBranch: true,
            SparesInventory: {
              include: { partNo: true }
            }
          },
          take: size,
          skip,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.spareInventoryTransfer.count({ where })
      ]);

      const formatted = records.map(r => ({
        id: r.id,
        createdAt: r.createdAt,
        quantity: r.quantity,
        fromBranch: r.fromBranch,
        toBranch: r.toBranch,
        spareInventory: r.spareInventory,
        fromBranchName: r.Branch_SpareInventoryTransfer_fromBranchToBranch?.name,
        toBranchName: r.Branch_SpareInventoryTransfer_toBranchToBranch?.name,
        partName: r.SparesInventory?.partNo?.partName || 'N/A',
        partNumber: r.SparesInventory?.partNo?.partNumber || 'N/A',
        transferStatus: r.spareInventory ? "Active" : "Completed",
        hasCurrentData: !!r.spareInventory
      }));

      return res.json({ code: 200, count, data: formatted });
    } catch (err) {
      logger.error("Get spares transfer history error:", err);
      return res.status(500).json({ code: 500, message: "Error fetching history" });
    }
  };

  /**
   * Number Plate Transfers
   */
  transferNumberPlates = async (req, res) => {
    try {
      const { fromBranch, toBranch, id } = req.body; // id is an array of NumberPlate IDs
      if (!fromBranch || !toBranch || !id || !Array.isArray(id)) {
         return res.status(400).json({ success: false, message: "Invalid payload" });
      }

      await prisma.$transaction(async (tx) => {
        const now = new Date();

        // 1. Update location in NumberPlate table
        await tx.numberPlate.updateMany({
          where: { id: { in: id } },
          data: { locationId: toBranch }
        });

        // 2. Create transfer records
        const logs = id.map(plateId => ({
          id: nanoid(20),
          createdAt: now,
          fromBranchId: fromBranch,
          toBranchId: toBranch,
          numberPlateId: plateId
        }));

        await tx.numberPlateTransfer.createMany({
          data: logs
        });
      });

      return res.json({ success: true, message: `${id.length} number plate(s) transferred successfully.` });
    } catch (err) {
      logger.error("Transfer number plates error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  };

  getNumberPlateTransferRecords = async (req, res) => {
     try {
       const { fromBranch, toBranch, startDate, endDate, searchString = "", page = 1, size = 10, branch } = req.body;
       const skip = (page - 1) * size;

       let branchIds = [];
       if (branch) {
         branchIds = Array.isArray(branch) ? branch : [branch];
       }

       const where = {
         AND: [
           branchIds.length > 0 ? {
             OR: [
               { fromBranchId: { in: branchIds } },
               { toBranchId: { in: branchIds } }
             ]
           } : {},
           {
             fromBranchId: fromBranch || undefined,
             toBranchId: toBranch || undefined,
             createdAt: (startDate || endDate) ? {
               gte: startDate ? new Date(startDate) : undefined,
               lte: endDate ? new Date(endDate) : undefined
             } : undefined,
             numberPlate: searchString ? {
               OR: [
                 { registerNo: { contains: searchString, mode: 'insensitive' } },
                 { chassisNo: { contains: searchString, mode: 'insensitive' } },
                 { modelName: { contains: searchString, mode: 'insensitive' } }
               ]
             } : undefined
           }
         ]
       };

       const [records, count] = await Promise.all([
         prisma.numberPlateTransfer.findMany({
           where,
           include: {
             fromBranch: true,
             toBranch: true,
             numberPlate: true
           },
           take: size,
           skip,
           orderBy: { createdAt: 'desc' }
         }),
         prisma.numberPlateTransfer.count({ where })
       ]);

       const formatted = records.map(r => ({
         id: r.id,
         createdAt: r.createdAt,
         fromBranch: {
           id: r.fromBranch?.id,
           name: r.fromBranch?.name
         },
         toBranch: {
           id: r.toBranch?.id,
           name: r.toBranch?.name
         },
         numberPlate: r.numberPlate
       }));

       return res.json({ code: 200, count, data: formatted });
     } catch (err) {
       logger.error("Get number plate transfer history error:", err);
       return res.status(500).json({ code: 500, message: "Error fetching history" });
     }
  };
}

export default new InventoryTransfersController();
