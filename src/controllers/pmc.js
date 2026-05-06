import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";

/**
 * Controller for PMC (Preventive Maintenance Schedule) operations.
 * Maintained with payload parity with autoinn-be.
 */
class PMCController {
  // Include object to fetch all relations
  pmcInclude = {
    vehicleMasters: {
      include: {
        Manufacturer: true
      }
    },
    PmcPartItem: {
      include: {
        partNumber: {
          include: {
            manufacturer: true
          }
        }
      }
    },
    PmcJobCodeItem: {
      include: {
        jobCode: true
      }
    }
  };

  /**
   * Helper to transform Prisma output to Legacy format (aliases)
   */
  transformPMC = (pmc) => {
    if (!pmc) return null;
    const { vehicleMasters, PmcPartItem, PmcJobCodeItem, ...rest } = pmc;
    return {
      ...rest,
      vehicleSuitable: vehicleMasters || [],
      partsConsumable: (PmcPartItem || []).filter(item => item.partNumber !== null),
      jobCodes: (PmcJobCodeItem || []).filter(item => item.jobCode !== null)
    };
  };

  createPMC = async (req, res) => {
    try {
      const { 
        serviceNo, 
        serviceType, 
        serviceKms, 
        vehicleSuitables, 
        partsConsumables, 
        jobCodes 
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const created = await prisma.pMC.create({
        data: {
          serviceNo: parseInt(serviceNo),
          serviceType,
          serviceKm: parseInt(serviceKms),
          createdAt: new Date(),
          updatedAt: new Date(),
          vehicleMasters: vehicleSuitables && vehicleSuitables.length > 0 ? {
            connect: vehicleSuitables.map(id => ({ id }))
          } : undefined,
          PmcPartItem: partsConsumables && partsConsumables.length > 0 ? {
            create: partsConsumables.filter(item => item.partNumber?.id).map(item => ({
              quantity: parseFloat(item.quantity),
              createdAt: new Date(),
              updatedAt: new Date(),
              partNumber: { connect: { id: item.partNumber.id } }
            }))
          } : undefined,
          PmcJobCodeItem: jobCodes && jobCodes.length > 0 ? {
            create: jobCodes.filter(item => item.code?.id).map(item => ({
              quantity: parseFloat(item.quantity),
              createdAt: new Date(),
              updatedAt: new Date(),
              jobCode: { connect: { id: item.code.id } }
            }))
          } : undefined
        },
        include: this.pmcInclude
      });

      logger.info(`PMC created: ${created.id} by user: ${user}`);

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "PMC created",
          data: this.transformPMC(created)
        }
      });
    } catch (err) {
      logger.error("Create PMC error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  updatePMC = async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        serviceNo, 
        serviceType, 
        serviceKms, 
        vehicleSuitables, 
        partsConsumables, 
        jobCodes,
        deleteData1, // vehicle suitable disconnects
        deleteData2, // parts consumable disconnects (though we usually recreate)
        deleteData3  // job codes disconnects
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      // Handle disconnects first if provided
      if (deleteData1 && deleteData1.length > 0) {
        await prisma.pMC.update({
          where: { id },
          data: { vehicleMasters: { disconnect: deleteData1.map(vid => ({ id: vid })) } }
        });
      }

      // Update basic fields and vehicle suitable connections
      await prisma.pMC.update({
        where: { id },
        data: {
          serviceNo: parseInt(serviceNo),
          serviceType,
          serviceKm: parseInt(serviceKms),
          updatedAt: new Date(),
          vehicleMasters: vehicleSuitables && vehicleSuitables.length > 0 ? {
            connect: vehicleSuitables.map(vid => ({ id: vid }))
          } : undefined,
        }
      });

      // For parts and job codes
      if (partsConsumables) {
        await prisma.pmcPartItem.deleteMany({
          where: { PMC: { some: { id } } }
        });
        
        if (partsConsumables.length > 0) {
          for (const item of partsConsumables) {
             if (item.partNumber?.id) {
               await prisma.pmcPartItem.create({
                 data: {
                   quantity: parseFloat(item.quantity),
                   createdAt: new Date(),
                   updatedAt: new Date(),
                   partNumber: { connect: { id: item.partNumber.id } },
                   PMC: { connect: { id } }
                 }
               });
             }
          }
        }
      }

      if (jobCodes) {
        await prisma.pmcJobCodeItem.deleteMany({
          where: { PMC: { some: { id } } }
        });

        if (jobCodes.length > 0) {
          for (const item of jobCodes) {
            if (item.code?.id) {
              await prisma.pmcJobCodeItem.create({
                data: {
                  quantity: parseFloat(item.quantity),
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  jobCode: { connect: { id: item.code.id } },
                  PMC: { connect: { id } }
                }
              });
            }
          }
        }
      }

      const finalResult = await prisma.pMC.findUnique({
        where: { id },
        include: this.pmcInclude
      });

      logger.info(`PMC updated: ${id}`);

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "PMC updated",
          data: this.transformPMC(finalResult)
        }
      });
    } catch (err) {
      logger.error("Update PMC error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  deletePMC = async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user?.id || req.headers["user-id"];

      // First delete associated items (if any orphaned)
      await prisma.pmcPartItem.deleteMany({ where: { PMC: { some: { id } } } });
      await prisma.pmcJobCodeItem.deleteMany({ where: { PMC: { some: { id } } } });

      await prisma.pMC.delete({
        where: { id }
      });

      logger.info(`PMC deleted: ${id} by user: ${user}`);

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "PMC deleted successfully"
        }
      });
    } catch (err) {
      logger.error("Delete PMC error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const pmc = await prisma.pMC.findUnique({
        where: { id },
        include: this.pmcInclude
      });

      if (pmc) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "PMC fetched",
            data: this.transformPMC(pmc)
          }
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one PMC error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getAll = async (req, res) => {
    try {
      const pmcs = await prisma.pMC.findMany({
        orderBy: { createdAt: 'desc' },
        include: this.pmcInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "PMCs fetched",
          data: pmcs.map(p => this.transformPMC(p))
        }
      });
    } catch (err) {
      logger.error("Get all PMCs error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page, size, searchString } = req.body;
      const parsedPage = parseInt(page) || 1;
      const parsedSize = size ? parseInt(size) : 10;
      const skip = (parsedPage - 1) * parsedSize;
      const inputValue = searchString || "";

      const where = {
        OR: [
          { serviceType: { contains: inputValue, mode: 'insensitive' } },
          { vehicleMasters: { some: { modelName: { contains: inputValue, mode: 'insensitive' } } } }
        ]
      };

      const [pmcs, count] = await Promise.all([
        prisma.pMC.findMany({
          where,
          take: parsedSize,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.pmcInclude
        }),
        prisma.pMC.count({ where })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "PMCs fetched",
          data: { 
            count, 
            pmc: pmcs.map(p => this.transformPMC(p)) 
          }
        }
      });
    } catch (err) {
      logger.error("Get PMC page error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  getCodes = async (req, res) => {
    try {
      const { kms, model, serviceNo } = req.body;
      
      const where = {
        AND: [
          { vehicleMasters: { some: { id: model } } },
          {
            OR: [
              { serviceNo: serviceNo ? parseInt(serviceNo) : undefined },
              { serviceKm: kms ? parseInt(kms) : undefined }
            ]
          }
        ]
      };

      const pmcs = await prisma.pMC.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: this.pmcInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "PMCs fetched",
          data: pmcs.map(p => this.transformPMC(p))
        }
      });
    } catch (err) {
      logger.error("Get PMC codes error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };
}

export default new PMCController();
