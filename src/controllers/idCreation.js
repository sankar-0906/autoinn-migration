import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

class IdCreationController {
  idCreationInclude = {
    Branch: {
      include: {
        address: {
          include: {
            district: true,
            state: true,
            country: true,
          },
        },
        contacts: true,
      },
    },
  };

  mapIdCreation = (item) => {
    if (!item) return item;
    const { Branch, ...rest } = item;
    // Keep the scalar 'branch' (ID string) and provide the relation 'Branch' (object)
    return {
      ...rest,
      Branch: Branch || null,
    };
  };

  createId = async (req, res) => {
    try {
      console.log("------------------- ID CREATION START -------------------");
      console.log("Payload:", JSON.stringify(req.body, null, 2));
      console.log("---------------------------------------------------------");
      const { subModule, text, count, scope, branch, resetAnnually } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const branchId = branch && typeof branch === "object" ? branch.id : branch;

      const duplicate = await prisma.idCreation.findFirst({
        where: { text, subModule, scope, branch: branchId || null },
      });

      if (duplicate) {
        return res.json({
          code: 200,
          response: { code: 400, msg: "Static text param already exists for this scope/branch" },
        });
      }

      const created = await prisma.idCreation.create({
        data: {
          subModule,
          text,
          startCount: count?.toString(),
          count: count?.toString(),
          scope,
          resetAnnually: resetAnnually === true || resetAnnually === "true" || resetAnnually === 1 || resetAnnually === "1" || resetAnnually === "TRUE",
          Branch: (branchId && branchId !== "" && branchId !== "null") ? { connect: { id: branchId } } : undefined,
          User: user ? { connect: { id: user } } : undefined,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        include: this.idCreationInclude,
      });

      return res.json({
        code: 200,
        response: { code: 200, message: "Id created", data: this.mapIdCreation(created) },
      });
    } catch (err) {
      logger.error("Create Id error:", err);
      return res.json({ code: 500, msg: "An error occured", err: err.message });
    }
  };

  updateId = async (req, res) => {
    try {
      const { id } = req.params;
      console.log("------------------- ID UPDATE START -------------------");
      console.log("ID:", id);
      console.log("Payload:", JSON.stringify(req.body, null, 2));
      console.log("-------------------------------------------------------");
      const { text, count, scope, branch, resetAnnually, subModule } = req.body;

      const branchId = branch && typeof branch === "object" ? branch.id : branch;

      const updated = await prisma.idCreation.update({
        where: { id },
        data: {
          text,
          startCount: count?.toString(),
          count: count?.toString(),
          scope,
          resetAnnually: resetAnnually === true || resetAnnually === "true" || resetAnnually === 1 || resetAnnually === "1" || resetAnnually === "TRUE",
          Branch: (branchId && branchId !== "" && branchId !== "null") ? { connect: { id: branchId } } : { disconnect: true },
          updatedAt: new Date(),
        },
        include: this.idCreationInclude,
      });

      return res.json({
        code: 200,
        response: { code: 200, message: "Id updated", data: this.mapIdCreation(updated) },
      });
    } catch (err) {
      logger.error("Update Id error:", err);
      return res.json({ code: 500, msg: "An error occured", err: err.message });
    }
  };

  deleteId = async (req, res) => {
    try {
      const { id } = req.params;
      await prisma.idCreation.delete({ where: { id } });
      return res.json({
        code: 200,
        response: { code: 200, message: "Id deleted permanently." },
      });
    } catch (err) {
      logger.error("Delete Id error:", err);
      return res.json({ code: 500, msg: "An error occured", err: err.message });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const result = await prisma.idCreation.findUnique({
        where: { id },
        include: this.idCreationInclude,
      });
      return res.json({
        code: 200,
        response: { code: 200, message: "Id fetched", data: this.mapIdCreation(result) },
      });
    } catch (err) {
      logger.error("Get one Id error:", err);
      return res.json({ code: 500, message: "Server error, Please check the logs", err: err.message });
    }
  };

  getPage = async (req, res) => {
    try {
      const { searchString, page = 1, size = 10 } = req.body;
      const skip = (parseInt(page) - 1) * parseInt(size);
      const take = parseInt(size);
      const inputValue = searchString || "";
      const tCased = await titleCase(inputValue);

      const where = {
        OR: [
          { text: { contains: inputValue, mode: "insensitive" } },
          { text: { contains: tCased, mode: "insensitive" } },
        ],
      };

      const [ids, count] = await Promise.all([
        prisma.idCreation.findMany({
          where,
          take: take,
          skip: skip,
          orderBy: { createdAt: "desc" },
          include: this.idCreationInclude,
        }),
        prisma.idCreation.count({ where }),
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "IDs fetched",
          data: { count, id: ids.map(this.mapIdCreation) },
        },
      });
    } catch (err) {
      logger.error("Get Id page error:", err);
      return res.json({ code: 500, msg: "An error occured", err: err.message });
    }
  };

  getAll = async (req, res) => {
    try {
      const result = await prisma.idCreation.findMany({
        include: this.idCreationInclude,
      });
      return res.json({
        code: 200,
        response: { code: 200, message: "All Ids fetched", data: result.map(this.mapIdCreation) },
      });
    } catch (err) {
      logger.error("Get all Ids error:", err);
      return res.json({ code: 500, msg: "An error occured", err: err.message });
    }
  };
}

export default new IdCreationController();
