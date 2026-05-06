import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";

class PineLabsController {
  /**
   * Format Pinelabs record for frontend compatibility
   */
  formatPinelabs = async (pl) => {
    if (!pl) return null;

    let branchData = null;
    let userData = [];

    // Fetch branch details if linked
    if (pl.branch) {
      const branch = await prisma.branch.findUnique({ 
        where: { id: pl.branch },
        select: { id: true, name: true }
      });
      if (branch) branchData = branch;
    }

    // Fetch associated user profiles
    if (pl.userIds && pl.userIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: pl.userIds } },
        select: {
          id: true,
          EmployeeProfile_User_profileToEmployeeProfile: {
            select: { employeeName: true }
          }
        }
      });

      userData = users.map((u) => ({
        id: u.id,
        name: u.EmployeeProfile_User_profileToEmployeeProfile ? u.EmployeeProfile_User_profileToEmployeeProfile.employeeName : "N/A",
      }));
    }

    return {
      ...pl,
      branch: branchData,
      userIds: userData,
    };
  };

  create = async (payload) => {
    try {
      const { 
        machineId, clientId, merchantId, storeId, 
        securityToken, branch, userIds, MBR, accountBalance 
      } = payload;

      const created = await prisma.pinelabs.create({
        data: {
          machineId,
          clientId,
          merchantId,
          storeId,
          securityToken,
          branch,
          userIds: userIds || [],
          MBR: Number(MBR) || 0,
          accountBalance: Number(accountBalance) || 0,
          createdAt: new Date(),
        },
      });

      return {
        code: 200,
        message: "Pinelabs record created successfully",
        data: await this.formatPinelabs(created),
      };
    } catch (err) {
      logger.error("CONTROLLER.Pinelabs.create", err);
      throw {
        code: 500,
        message: "Error creating Pinelabs record",
        err,
      };
    }
  };

  getAll = async ({ searchString = "", page = 1, size = 10 }) => {
    try {
      const skip = (Number(page) - 1) * Number(size);
      const take = Number(size);

      const where = searchString
        ? {
            OR: [
              { machineId: { contains: searchString, mode: "insensitive" } },
              { clientId: { contains: searchString, mode: "insensitive" } },
              { merchantId: { contains: searchString, mode: "insensitive" } },
              { storeId: { contains: searchString, mode: "insensitive" } },
            ],
          }
        : {};

      const [records, totalCount] = await Promise.all([
        prisma.pinelabs.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: "desc" },
        }),
        prisma.pinelabs.count({ where })
      ]);

      const enrichedRecords = await Promise.all(
        records.map(record => this.formatPinelabs(record))
      );

      return {
        code: 200,
        message: "Pinelabs records fetched successfully",
        data: {
          records: enrichedRecords,
          totalCount,
          currentPage: Number(page),
          pageSize: take,
          totalPages: Math.ceil(totalCount / take),
        },
      };
    } catch (err) {
      logger.error("CONTROLLER.Pinelabs.getAll", err);
      throw {
        code: 500,
        message: "Error fetching Pinelabs records",
        err,
      };
    }
  };

  update = async (id, payload) => {
    try {
      const { 
        machineId, clientId, merchantId, storeId, 
        securityToken, branch, userIds, MBR, accountBalance 
      } = payload;

      const updated = await prisma.pinelabs.update({
        where: { id },
        data: {
          machineId,
          clientId,
          merchantId,
          storeId,
          securityToken,
          branch,
          userIds: userIds ? { set: userIds } : undefined,
          MBR: MBR !== undefined ? Number(MBR) : undefined,
          accountBalance: accountBalance !== undefined ? Number(accountBalance) : undefined,
        },
      });

      return {
        code: 200,
        message: "Pinelabs record updated successfully",
        data: await this.formatPinelabs(updated),
      };
    } catch (err) {
      logger.error("CONTROLLER.Pinelabs.update", err);
      throw {
        code: 500,
        message: "Error updating Pinelabs record",
        err,
      };
    }
  };

  delete = async (id) => {
    try {
      await prisma.pinelabs.delete({ where: { id } });
      return {
        code: 200,
        message: "Pinelabs record deleted successfully",
      };
    } catch (err) {
      logger.error("CONTROLLER.Pinelabs.delete", err);
      throw {
        code: 500,
        message: "Error deleting Pinelabs record",
        err,
      };
    }
  };
}

export default new PineLabsController();
