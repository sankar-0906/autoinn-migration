import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";

/**
 * Controller for Material Issue (Parts issued to Job Orders).
 */
class MaterialIssueController {
  fragment = {
    job: {
      include: {
        customer: true,
        vehicle: {
          include: {
            vehicleMaster: true
          }
        }
      }
    },
    MaterialPartsIssue: {
      include: {
        part: {
          include: {
            hsn: true,
            manufacturer: true,
            vehicleSuit: {
              include: {
                VehicleMaster: true
              }
            }
          }
        },
        mechanic: {
          include: {
            EmployeeProfile_User_profileToEmployeeProfile: true
          }
        }
      }
    },
    mechanic: {
      include: {
        EmployeeProfile_User_profileToEmployeeProfile: true
      }
    },
    branch: {
      include: {
        manufacturer: true,
        personInCharge: {
          include: {
            EmployeeProfile_User_profileToEmployeeProfile: true
          }
        }
      }
    }
  };

  formatMaterialIssue = (m) => {
    if (!m) return m;
    const formatted = { ...m };

    // Format branch
    if (formatted.branch) {
      formatted.branch = this.formatBranch(formatted.branch);
    }

    // Format mechanic
    if (formatted.mechanic) {
      formatted.mechanic = {
        ...formatted.mechanic,
        profile: formatted.mechanic.EmployeeProfile_User_profileToEmployeeProfile || null
      };
      delete formatted.mechanic.EmployeeProfile_User_profileToEmployeeProfile;
    }

    // Format job
    if (formatted.job) {
      const job = { ...formatted.job };
      if (job.vehicle) {
        // Alias vehicleMaster to vehicle for frontend
        job.vehicle = {
          ...job.vehicle,
          vehicle: job.vehicle.vehicleMaster || {}
        };
        delete job.vehicle.vehicleMaster;
      }
      // Ensure customer exists
      if (!job.customer) {
        job.customer = { name: "Unknown" };
      }
      formatted.job = job;
    }

    // Format mechanic
    if (formatted.mechanic) {
      const profile = formatted.mechanic.EmployeeProfile_User_profileToEmployeeProfile || 
                      formatted.mechanic.EmployeeProfile || 
                      null;
      formatted.mechanic = {
        ...formatted.mechanic,
        profile: profile
      };
      delete formatted.mechanic.EmployeeProfile_User_profileToEmployeeProfile;
      delete formatted.mechanic.EmployeeProfile;
    }

    // Format parts
    if (formatted.MaterialPartsIssue) {
      formatted.materialIssuePart = formatted.MaterialPartsIssue.map(p => {
        const partIssue = { ...p };
        try {
          // Format part mechanic
          if (partIssue.mechanic) {
            const mProfile = partIssue.mechanic.EmployeeProfile_User_profileToEmployeeProfile || 
                             partIssue.mechanic.EmployeeProfile || 
                             null;
            partIssue.mechanic = {
              ...partIssue.mechanic,
              profile: mProfile
            };
            delete partIssue.mechanic.EmployeeProfile_User_profileToEmployeeProfile;
            delete partIssue.mechanic.EmployeeProfile;
          }
          
          // Ensure part and partNumber exist for frontend stability
          if (!partIssue.part) {
            partIssue.part = { id: null, partNumber: "", partName: partIssue.partName || "" };
          }
          
          if (partIssue.part.vehicleSuit) {
            partIssue.part.vehicleSuit = partIssue.part.vehicleSuit.map(vs => ({
              ...vs,
              vehicle: vs.VehicleMaster || null
            }));
          }
          
          // Frontend expects both 'part' and 'partNumber'
          partIssue.partNumber = partIssue.part;
          
        } catch (e) {
          logger.error(e, "Error formatting part issue item");
        }
        return partIssue;
      });
      
      // Legacy parity keys
      formatted.materialItemInvoice = formatted.materialIssuePart;
      formatted.parts = formatted.materialIssuePart;
      delete formatted.MaterialPartsIssue;
    }

    return formatted;
  };

  formatBranch = (branch) => {
    if (!branch) return branch;
    const b = { ...branch };
    if (b.personInCharge) {
      b.personInCharge = b.personInCharge.map(u => ({
        id: u.id,
        phone: u.phone,
        phone2: u.phone2,
        profile: u.EmployeeProfile_User_profileToEmployeeProfile ? {
          id: u.EmployeeProfile_User_profileToEmployeeProfile.id,
          employeeName: u.EmployeeProfile_User_profileToEmployeeProfile.employeeName
        } : null
      }));
    }
    return b;
  };

  getPage = async (req, res) => {
    try {
      const { page = 1, size = 10, searchString = "" } = req.body;
      const skip = (parseInt(page) - 1) * parseInt(size);
      const take = parseInt(size);

      let where = {};
      if (searchString) {
        const search = searchString.toLowerCase();
        where = {
          OR: [
            {
              job: {
                OR: [
                  { jobNo: { contains: search, mode: 'insensitive' } },
                  { customer: { name: { contains: search, mode: 'insensitive' } } },
                  { customerPhone: { contains: search, mode: 'insensitive' } },
                  { vehicle: { registerNo: { contains: search, mode: 'insensitive' } } },
                  { vehicle: { chassisNo: { contains: search, mode: 'insensitive' } } },
                  { vehicle: { engineNo: { contains: search, mode: 'insensitive' } } }
                ]
              }
            }
          ]
        };
      }

      const [materials, count] = await Promise.all([
        prisma.materialIssue.findMany({
          where,
          skip,
          take,
          include: this.fragment,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.materialIssue.count({ where })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Material Issues  fetched",
          data: {
            count: count.toString(),
            materialIssue: materials.map(m => this.formatMaterialIssue(m))
          }
        }
      });
    } catch (err) {
      logger.error(err, "Material issue getPage error");
      return res.json({ code: 500, msg: "An error occurred", error: err.message });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const material = await prisma.materialIssue.findUnique({
        where: { id },
        include: this.fragment
      });
      return res.json({
        code: 200,
        response: {
          code: 200,
          data: this.formatMaterialIssue(material)
        }
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

  getJobMaterial = async (req, res) => {
    try {
      const { id } = req.params; // JobOrder ID
      const branchIds = req.user?.branch || [];
      const branchArr = Array.isArray(branchIds) ? branchIds : [branchIds];

      logger.info(`Fetching materials for job: ${id} and branches: ${JSON.stringify(branchArr)}`);
      const materials = await prisma.materialIssue.findMany({
        where: {
          jobOrderId: id,
          branchId: { in: branchArr }
        },
        include: this.fragment,
        orderBy: { createdAt: 'desc' }
      });
      logger.info(`Found ${materials.length} material issues`);

      return res.json({
        code: 200,
        response: {
          code: 200,
          data: materials.map(m => this.formatMaterialIssue(m))
        }
      });
    } catch (err) {
      logger.error("Get job material error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  create = async (req, res) => {
    try {
      const {
        jobOrder,
        materialItemInvoice = [],
        mechanic,
        currentDate,
        branch,
        netAmount,
        slipNumber,
      } = req.body;

      const user = req.user?.id;

      // Process OC parts
      for (const item of materialItemInvoice) {
        if (item.partNumber?.partNumber && (item.partNumber.partNumber.toLowerCase().includes("ocpart"))) {
          const partsMaster = await prisma.partsMaster.findFirst({
            where: {
              OR: [
                { partName: { contains: item.partNumber.partNumber, mode: 'insensitive' } },
                { partNumber: { contains: item.partNumber.partNumber, mode: 'insensitive' } }
              ]
            }
          });
          if (partsMaster) {
            item.partNumber.id = partsMaster.id;
          }
        }
      }

      // Create MaterialIssue and nested MaterialPartsIssue
      const materialIssue = await prisma.materialIssue.create({
        data: {
          issueDate: new Date(currentDate),
          netAmount: parseFloat(netAmount || 0),
          slipNumber: parseInt(slipNumber) || 1,
          createdAt: new Date(),
          job: jobOrder ? { connect: { id: jobOrder } } : undefined,
          mechanic: mechanic ? { connect: { id: mechanic } } : undefined,
          branch: branch ? { connect: { id: branch } } : undefined,
          createdBy: user ? { connect: { id: user } } : undefined,
          MaterialPartsIssue: {
            create: materialItemInvoice.map(item => ({
              part: item.partNumber?.id ? { connect: { id: item.partNumber.id } } : undefined,
              partName: item.partNumber?.partName || item.partName,
              issueType: item.issueType || "PAID",
              issueDate: item.issueDate ? new Date(item.issueDate) : new Date(currentDate),
              quantity: parseFloat(item.quantity || 0),
              mrp: parseFloat(item.mrp || 0),
              slipNumber: parseInt(item.slipNumber) || parseInt(slipNumber) || 1,
              createdAt: new Date(),
              mechanic: item.mechanic?.id ? { connect: { id: item.mechanic.id } } : (mechanic ? { connect: { id: mechanic } } : undefined),
              branch: branch ? { connect: { id: branch } } : undefined,
            }))
          }
        },
        include: this.fragment
      });

      // Update inventory and create transactions
      for (let item of materialItemInvoice) {
        if (item.partNumber?.id && branch) {
          const inventory = await prisma.sparesInventory.findFirst({
            where: {
              partId: item.partNumber.id,
              branchId: branch
            }
          });

          if (inventory) {
            await prisma.sparesInventory.update({
              where: { id: inventory.id },
              data: {
                phyQuantity: { decrement: parseFloat(item.quantity || 0) }
              }
            });

            await prisma.transactions.create({
              data: {
                type: "JobCard Material Invoice",
                Quantity: Math.round(parseFloat(item.quantity || 0)),
                status: "False",
                Part: { connect: { id: item.partNumber.id } },
                branch: branch ? { connect: { id: branch } } : undefined,
                sparesMaterialSale: { connect: { id: materialIssue.id } },
                createdAt: new Date()
              }
            });
          }
        }
      }

      return res.json({
        code: 200,
        response: {
          code: 200,
          data: this.formatMaterialIssue(materialIssue)
        }
      });
    } catch (err) {
      logger.error("Create material issue error:", err);
      return res.json({ code: 500, msg: "An error occurred", error: err.toString() });
    }
  };

  update = async (req, res) => {
    try {
      const { id } = req.params;
      const {
        materialItemInvoice = [],
        deletePartData = [],
        netAmount,
        mechanic,
        branch
      } = req.body;

      // Process OC parts
      for (const item of materialItemInvoice) {
        if (item.partNumber?.partNumber && (item.partNumber.partNumber.toLowerCase().includes("ocpart"))) {
          const partsMaster = await prisma.partsMaster.findFirst({
            where: {
              OR: [
                { partName: { contains: item.partNumber.partNumber, mode: 'insensitive' } },
                { partNumber: { contains: item.partNumber.partNumber, mode: 'insensitive' } }
              ]
            }
          });
          if (partsMaster) {
            item.partNumber.id = partsMaster.id;
          }
        }
      }

      // 1. Handle Deletions
      for (const delId of deletePartData) {
        const mpi = await prisma.materialPartsIssue.findUnique({
          where: { id: delId }
        });
        if (mpi) {
          // Revert inventory
          if (mpi.partId && mpi.branchId) {
            await prisma.sparesInventory.updateMany({
              where: { partId: mpi.partId, branchId: mpi.branchId },
              data: { phyQuantity: { increment: mpi.quantity || 0 } }
            });
          }
          // Delete transactions
          await prisma.transactions.deleteMany({
            where: {
              sparesMaterialSale: { id: id },
              Part: { id: mpi.partId }
            }
          });
          // Delete part issue
          await prisma.materialPartsIssue.delete({ where: { id: delId } });
        }
      }

      // 2. Update existing and create new parts
      for (const item of materialItemInvoice) {
        if (item.id && !item.id.startsWith("new_")) {
          // Update existing
          const oldMpi = await prisma.materialPartsIssue.findUnique({
            where: { id: item.id }
          });
          
          if (oldMpi) {
            const qtyDiff = parseFloat(item.quantity || 0) - (oldMpi.quantity || 0);
            if (qtyDiff !== 0 && oldMpi.partId && oldMpi.branchId) {
              await prisma.sparesInventory.updateMany({
                where: { partId: oldMpi.partId, branchId: oldMpi.branchId },
                data: { phyQuantity: { decrement: qtyDiff } }
              });
              
              // Update transaction
              await prisma.transactions.updateMany({
                where: {
                  sparesMaterialSale: { id: id },
                  Part: { id: oldMpi.partId }
                },
                data: { Quantity: Math.round(parseFloat(item.quantity || 0)) }
              });
            }

            await prisma.materialPartsIssue.update({
              where: { id: item.id },
              data: {
                quantity: parseFloat(item.quantity || 0),
                mrp: parseFloat(item.mrp || 0),
                issueType: item.issueType,
                mechanic: item.mechanic?.id ? { connect: { id: item.mechanic.id } } : undefined
              }
            });
          }
        } else {
          // Create new
          await prisma.materialPartsIssue.create({
            data: {
              materialIssue: { connect: { id: id } },
              part: item.partNumber?.id ? { connect: { id: item.partNumber.id } } : undefined,
              partName: item.partNumber?.partName || item.partName,
              quantity: parseFloat(item.quantity || 0),
              mrp: parseFloat(item.mrp || 0),
              issueType: item.issueType || "PAID",
              issueDate: new Date(),
              createdAt: new Date(),
              branch: branch ? { connect: { id: branch } } : undefined,
              mechanic: item.mechanic?.id ? { connect: { id: item.mechanic.id } } : undefined
            }
          });

          // Update inventory
          if (item.partNumber?.id && branch) {
            await prisma.sparesInventory.updateMany({
              where: { partId: item.partNumber.id, branchId: branch },
              data: { phyQuantity: { decrement: parseFloat(item.quantity || 0) } }
            });

            await prisma.transactions.create({
              data: {
                type: "JobCard Material Invoice",
                Quantity: Math.round(parseFloat(item.quantity || 0)),
                status: "False",
                Part: { connect: { id: item.partNumber.id } },
                branch: branch ? { connect: { id: branch } } : undefined,
                sparesMaterialSale: { connect: { id: id } }
              }
            });
          }
        }
      }

      // 3. Update main record
      const materialIssue = await prisma.materialIssue.update({
        where: { id },
        data: {
          netAmount: parseFloat(netAmount || 0),
          mechanic: mechanic ? { connect: { id: mechanic } } : undefined
        },
        include: this.fragment
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          data: this.formatMaterialIssue(materialIssue)
        }
      });
    } catch (err) {
      logger.error("Update material issue error:", err);
      return res.json({ code: 500, msg: "An error occurred", error: err.toString() });
    }
  };

  delete = async (req, res) => {
    try {
      const { id } = req.params;

      const materialIssue = await prisma.materialIssue.findUnique({
        where: { id },
        include: { MaterialPartsIssue: true }
      });

      if (!materialIssue) {
        return res.json({ code: 404, msg: "Material issue not found" });
      }

      // Revert inventory and delete transactions for each part
      for (let item of materialIssue.MaterialPartsIssue) {
        if (item.partId && item.branchId) {
          // Update inventory
          await prisma.sparesInventory.updateMany({
            where: {
              partId: item.partId,
              branchId: item.branchId
            },
            data: {
              phyQuantity: { increment: item.quantity || 0 }
            }
          });

          // Delete transactions
          await prisma.transactions.deleteMany({
            where: {
              sparesMaterialSale: { id: id },
              Part: { id: item.partId }
            }
          });
        }
      }

      // Delete MaterialPartsIssue records
      const partIds = materialIssue.MaterialPartsIssue.map(p => p.id);
      await prisma.materialPartsIssue.deleteMany({
        where: { id: { in: partIds } }
      });

      // Delete the main MaterialIssue record
      await prisma.materialIssue.delete({
        where: { id }
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Material Issue deleted successfully"
        }
      });
    } catch (err) {
      logger.error("Delete material issue error:", err);
      return res.json({ code: 500, msg: "An error occurred", error: err.toString() });
    }
  };

  importFromEstimate = async (req, res) => {
    try {
      const { jobOrderNo } = req.params;
      const branchIds = req.user?.branch || [];
      const branchArr = Array.isArray(branchIds) ? branchIds : [branchIds];

      const jobOrder = await prisma.jobOrder.findFirst({
        where: { id: jobOrderNo, branchId: { in: branchArr } }
      });

      if (!jobOrder) {
        return res.json({ code: 404, message: "Job order not found" });
      }

      const latestEstimate = await prisma.estimate.findFirst({
        where: { jobOrderId: jobOrderNo, estimateStatus: "APPROVED" },
        orderBy: { createdAt: 'desc' },
        include: {
          EstimateItem: {
            where: { status: "APPROVED" },
            include: { partNumber: { include: { manufacturer: true } } }
          }
        }
      });

      if (!latestEstimate) {
        return res.json({ code: 404, message: "No approved estimate found" });
      }

      const availableParts = [];
      const unavailableParts = [];

      for (const item of latestEstimate.EstimateItem) {
        if (!item.partNumber) continue;

        const inventory = await prisma.sparesInventory.findFirst({
          where: { partNoId: item.partNumber.id, branchId: jobOrder.branchId }
        });

        const phyQty = inventory ? parseFloat(inventory.physicalQuantity || 0) : 0;
        const requestedQty = parseFloat(item.quantity || 0);

        const partData = {
          id: item.id,
          partNumber: item.partNumber,
          quantity: item.quantity,
          unitRate: item.unitRate
        };

        if (phyQty >= requestedQty) {
          availableParts.push({ ...partData, available: true });
        } else {
          unavailableParts.push({ ...partData, available: false, availableQuantity: phyQty });
        }
      }

      return res.json({
        code: 200,
        message: "Parts retrieved from estimate",
        data: {
          jobOrderId: jobOrder.id,
          estimateId: latestEstimate.id,
          totalParts: latestEstimate.EstimateItem.length,
          availableCount: availableParts.length,
          availableParts,
          unavailableParts
        }
      });
    } catch (err) {
      logger.error("Import from estimate error:", err);
      return res.json({ code: 500, message: "Server error", error: err.toString() });
    }
  };

  importFromEstimateCso = async (req, res) => {
    try {
      const { jobOrderNo } = req.params;
      const branchIds = req.user?.branch || [];
      const branchArr = Array.isArray(branchIds) ? branchIds : [branchIds];

      const jobOrder = await prisma.jobOrder.findFirst({
        where: { id: jobOrderNo, branchId: { in: branchArr } }
      });

      if (!jobOrder) {
        return res.json({ code: 404, message: "Job order not found" });
      }

      const latestEstimate = await prisma.estimate.findFirst({
        where: { jobOrderId: jobOrderNo, estimateStatus: "APPROVED" },
        orderBy: { createdAt: 'desc' },
        include: {
          EstimateItem: {
            where: { status: "APPROVED" },
            include: { partNumber: { include: { manufacturer: true } } }
          }
        }
      });

      if (!latestEstimate) {
        return res.json({ code: 404, message: "No approved estimate found" });
      }

      const availableParts = latestEstimate.EstimateItem.map(item => ({
        id: item.id,
        partNumber: item.partNumber,
        quantity: item.quantity,
        unitRate: item.unitRate,
        available: true
      }));

      return res.json({
        code: 200,
        message: "Parts retrieved from estimate",
        data: {
          jobOrderId: jobOrder.id,
          estimateId: latestEstimate.id,
          totalParts: latestEstimate.EstimateItem.length,
          availableCount: availableParts.length,
          availableParts
        }
      });
    } catch (err) {
      logger.error("Import from estimate CSO error:", err);
      return res.json({ code: 500, message: "Server error", error: err.toString() });
    }
  };
}

export default new MaterialIssueController();
