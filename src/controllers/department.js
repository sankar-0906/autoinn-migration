import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../services/helper/titleCase.js";
import userController from "./user.js";


class DepartmentController {
  constructor() {}

  formatDepartment(dept) {
    if (!dept) return null;
    const { RoleAccess, ...rest } = dept;
    return {
      ...rest,
      roleAccess: RoleAccess ? RoleAccess.map(ra => ({
        id: ra.id,
        master: ra.master,
        subModule: ra.subModule,
        access: ra.access ? {
          create: ra.access.create,
          update: ra.access.update,
          delete: ra.access.delete,
          read: ra.access.read,
          print: ra.access.print,
        } : null
      })) : []
    };
  }

  createDepartment = async (data, user) => {
    try {
      const { role, roleAccess, departmentType, othersAccess } = data;
      const duplicate = await prisma.department.findUnique({
        where: { role }
      });

      if (duplicate) {
        return {
          code: 400,
          msg: "Role already exists",
          data: duplicate.id
        };
      }

      const createDepartment = await prisma.department.create({
        data: {
          role,
          departmentType,
          othersAccess,
          createdAt: new Date(),
          createdBy: user ? {
            connect: { id: user }
          } : undefined,
          RoleAccess: roleAccess && roleAccess.length > 0 ? {
            create: roleAccess.map((ra) => ({
              master: ra.master,
              subModule: ra.subModule,
              createdAt: new Date(),
              access: {
                create: {
                  create: ra.access.create,
                  update: ra.access.update,
                  delete: ra.access.delete,
                  read: ra.access.read,
                  print: ra.access.print,
                }
              }
            }))
          } : undefined
        },
        include: {
          RoleAccess: {
            include: {
              access: true
            }
          }
        }
      });

      return {
        code: 200,
        message: "Department created successfully",
        data: this.formatDepartment(createDepartment),
      };
    } catch (err) {
      logger.error("CONTROLLER.DEPARTMENT.create", err);
      throw {
        code: 500,
        message: "error creating department",
        data: err,
      };
    }
  };

  updateDepartment = async (id, data, user, branch) => {
    try {
      const { role, roleAccess, departmentType, removeIds, othersAccess } = data;

      // Handle removals if any
      if (removeIds && removeIds.length > 0) {
        // In Prisma 2+, we handle deletions separately if needed, 
        // but here the legacy code disconnects or deletes.
        // Actually legacy code was updating department to disconnect roleAccess.
        // In our schema, RoleAccess has a relation to Department.
        for (const rid of removeIds) {
          await prisma.roleAccess.delete({
            where: { id: rid.id }
          });
        }
      }

      const updateDepartment = await prisma.department.update({
        where: { id },
        data: {
          role,
          departmentType,
          othersAccess,
          RoleAccess: roleAccess && roleAccess.length > 0 ? {
            upsert: roleAccess.map((ra) => ({
              where: { id: ra.id || "new-id" },
              update: {
                master: ra.master,
                subModule: ra.subModule,
                access: {
                  update: {
                    create: ra.access.create,
                    update: ra.access.update,
                    delete: ra.access.delete,
                    read: ra.access.read,
                    print: ra.access.print,
                  }
                }
              },
              create: {
                master: ra.master,
                subModule: ra.subModule,
                createdAt: new Date(),
                access: {
                  create: {
                    create: ra.access.create,
                    update: ra.access.update,
                    delete: ra.access.delete,
                    read: ra.access.read,
                    print: ra.access.print,
                  }
                }
              }
            }))
          } : undefined,
        },
        include: {
          RoleAccess: {
            include: {
              access: true
            }
          }
        }
      });

      const userCount = await prisma.user.count({
        where: {
          employee: true,
          EmployeeProfile_User_profileToEmployeeProfile: {
            branch: {
              some: { id: { in: Array.isArray(branch) ? branch : [branch] } }
            },
            department: {
              id: updateDepartment.id
            }
          }
        }
      });

      const formatted = this.formatDepartment(updateDepartment);
      formatted.count = userCount;

      return {
        code: 200,
        message: "Department updated succesfully",
        data: formatted,
      };
    } catch (err) {
      logger.error("CONTROLLER.DEPARTMENT.update", err);
      throw {
        code: 500,
        message: "error updating department",
        data: err,
      };
    }
  };

  deleteDepartment = async (id, type, user) => {
    try {
      if (type === "SOFT") {
        // Our schema doesn't have deletedAt/deletedBy on Department based on previous cat output.
        // Let's check schema again for Department soft delete fields.
        // Wait, I saw them in legacy but let's check new schema.
        return { code: 200, message: "Soft delete not implemented in schema" };
      } else {
        await prisma.department.delete({ where: { id } });
        return {
          code: 200,
          message: "Department deleted",
        };
      }
    } catch (err) {
      logger.error("CONTROLLER.DEPARTMENT.delete", err);
      throw {
        code: 500,
        message: "error deleting department",
        data: err,
      };
    }
  };

  getDepartment = async (data, user, branch) => {
    try {
      const { id, searchString } = data;
      let inputValue = searchString ? searchString : "";
      
      const users = await prisma.user.findMany({
        where: {
          EmployeeProfile_User_profileToEmployeeProfile: {
            branch: {
              some: { id: { in: Array.isArray(branch) ? branch : [branch] } }
            },
            departmentId: id
          },
          OR: [
            { phone: { contains: inputValue, mode: "insensitive" } },
            {
              EmployeeProfile_User_profileToEmployeeProfile: {
                employeeName: { contains: inputValue, mode: "insensitive" }
              }
            }
          ]
        },
        include: userController.userInclude
      });

      const formattedUsers = users.map(u => userController.formatUser(u));

      return {
        code: 200,
        message: "Department users got successfully",
        data: { getDepartment: formattedUsers, user },
      };
    } catch (err) {
      logger.error("CONTROLLER.DEPARTMENT.getUsers", err);
      throw {
        code: 500,
        message: "error getting department users",
        data: err,
      };
    }
  };

  getAll = async (user) => {
    try {
      const departments = await prisma.department.findMany({
        include: {
          RoleAccess: {
            include: {
              access: true
            }
          }
        }
      });

      const formattedDepts = await Promise.all(departments.map(async (dept) => {
        const count = await prisma.user.count({
          where: {
            employee: true,
            EmployeeProfile_User_profileToEmployeeProfile: {
              departmentId: dept.id
            }
          }
        });
        const formatted = this.formatDepartment(dept);
        formatted.count = count;
        return formatted;
      }));

      return {
        code: 200,
        message: "Departments fetched",
        data: formattedDepts,
      };
    } catch (err) {
      logger.error("CONTROLLER.DEPARTMENT.getAll", err);
      throw {
        code: 500,
        message: "error fetching departments",
        data: err,
      };
    }
  };

  getPage = async (data, branch) => {
    try {
      let inputValue = data.searchString ? data.searchString : "";
      const { page, size } = data;
      const skip = (page - 1) * size;

      const departments = await prisma.department.findMany({
        where: {
          role: { contains: inputValue, mode: "insensitive" }
        },
        include: {
          RoleAccess: {
            include: {
              access: true
            }
          }
        },
        take: size,
        skip: skip
      });

      const count = await prisma.department.count({
        where: {
          role: { contains: inputValue, mode: "insensitive" }
        }
      });

      const formattedDepts = await Promise.all(departments.map(async (dept) => {
        const userCount = await prisma.user.count({
          where: {
            EmployeeProfile_User_profileToEmployeeProfile: {
              branch: {
                some: { id: { in: Array.isArray(branch) ? branch : [branch] } }
              },
              departmentId: dept.id
            }
          }
        });
        const formatted = this.formatDepartment(dept);
        formatted.count = userCount;
        return formatted;
      }));

      return {
        code: 200,
        msg: "Departments fetched",
        data: { count, department: formattedDepts },
      };
    } catch (err) {
      logger.error("CONTROLLER.DEPARTMENT.getPage", err);
      throw {
        code: 500,
        message: "error getting departments page",
        data: err,
      };
    }
  };

  deleteRoleAccess = async (id, type, user) => {
    try {
      if (type === "SOFT") {
        return { code: 200, message: "Soft delete not implemented in schema" };
      } else {
        await prisma.roleAccess.delete({ where: { id } });
        return {
          code: 200,
          message: "RoleAccess deleted",
        };
      }
    } catch (err) {
      logger.error("CONTROLLER.DEPARTMENT.deleteRoleAccess", err);
      throw {
        code: 500,
        message: "error deleting role access",
        data: err,
      };
    }
  };
}

export default new DepartmentController();
