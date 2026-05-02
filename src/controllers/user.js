import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import JWT from "../services/jwt.service.js";
import bcrypt from "bcryptjs";
import joi from "joi";

/**
 * Controller for User operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class UserController {
  // Shared include object to mirror the legacy createFragment
  userInclude = {
    EmployeeProfile_User_profileToEmployeeProfile: {
      include: {
        documents: {
          include: {
            files: true
          }
        },
        department: {
          include: {
            RoleAccess: {
              include: {
                access: true
              }
            }
          }
        },
        branch: {
          include: {
            manufacturer: true,
            company: true
          }
        },
        address: {
          include: {
            district: true,
            state: true,
            country: true
          }
        },
        bankDetails: true
      }
    }
  };

  // Shared include object to mirror the legacy branches fragment
  branchInclude = {
    manufacturer: true,
    address: {
      include: {
        district: true,
        state: true,
        country: true
      }
    },
    contacts: true,
    bankDetails: true,
    company: true
  };

  /**
   * Helper to format Department object (mapping RoleAccess to roleAccess).
   */
  formatDepartment(dept) {
    if (!dept) return null;
    const { RoleAccess, ...rest } = dept;
    return {
      ...rest,
      roleAccess: RoleAccess || []
    };
  }

  /**
   * Helper to format User object to match legacy fragment structure.
   */
  formatUser(user) {
    if (!user) return null;
    const { EmployeeProfile_User_profileToEmployeeProfile, ...rest } = user;
    
    if (EmployeeProfile_User_profileToEmployeeProfile) {
      const profile = { ...EmployeeProfile_User_profileToEmployeeProfile };
      
      // Ensure branch is an array
      profile.branch = profile.branch || [];
      
      // Format department if exists
      if (profile.department) {
        profile.department = this.formatDepartment(profile.department);
      }

      return {
        ...rest,
        profile
      };
    }

    return {
      ...rest,
      profile: null
    };
  }

  /**
   * Helper to format Branch object to match legacy fragment structure.
   */
  formatBranch(branch) {
    if (!branch) return null;
    return {
      ...branch,
      // Mirroring the legacy logic of ensuring certain fields exist
      count: branch._count?.employeeProfiles || 0
    };
  }

  login = async (req, res) => {
    try {
      const { phone, password } = req.body;

      const schema = joi.object({
        phone: joi.string().required(),
        password: joi.string().required(),
      });

      const { error } = schema.validate({ phone, password });
      if (error) {
        return res.json({ code: 422, msg: error.details[0].message });
      }

      const user = await prisma.user.findFirst({
        where: { phone2: phone }
      });

      if (!user) {
        return res.json({
          code: 200,
          response: {
            code: 403,
            message: "User does not exist!",
            data: null,
          }
        });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.json({
          code: 200,
          response: {
            code: 403,
            message: "Password Does not match",
            data: null,
          }
        });
      }

      if (user.status === false) {
        return res.json({
          code: 200,
          response: {
            code: 404,
            message: "This user is inactive",
            data: null
          }
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
        include: this.userInclude
      });

      const formattedUser = this.formatUser(updatedUser);

      const payload = {
        id: user.id,
        branch: (formattedUser.profile?.branch?.length > 0) 
          ? formattedUser.profile.branch[0].id 
          : null
      };

      const token = await JWT.sign(payload, "2d");

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "USER_LOGGED_IN",
          data: {
            user: {
              ...user,
              password: undefined,
              name: formattedUser.profile?.employeeName,
              department: formattedUser.profile?.department,
              company: (formattedUser.profile?.branch?.length > 0)
                ? formattedUser.profile.branch[0].company
                : null,
            },
            token,
          },
        }
      });
    } catch (err) {
      logger.error("Login error:", err);
      return res.json({ code: 500, msg: "An error occurred !" });
    }
  };

  currentUser = async (req, res) => {
    try {
      const user = req.user?.id || req.headers["user-id"];
      const response = await prisma.user.findUnique({
        where: { id: user },
        include: this.userInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "user fetched",
          data: this.formatUser(response),
        }
      });
    } catch (err) {
      logger.error("Current user error:", err);
      return res.json({ code: 500, msg: "an error occured" });
    }
  };

  department = async (req, res) => {
    try {
      const dept = await prisma.department.findMany();
      return res.json({
        code: 200,
        message: "departments fetched",
        data: dept,
      });
    } catch (err) {
      logger.error("Department fetch error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  branch = async (req, res) => {
    try {
      const branches = await prisma.branch.findMany({
        include: {
          ...this.branchInclude,
          _count: {
            select: { employeeProfiles: true }
          }
        }
      });

      return res.json({
        code: 200,
        message: "branches fetched",
        data: branches.map(b => this.formatBranch(b)),
      });
    } catch (err) {
      logger.error("Branch fetch error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getUserRoleAccess = async (req, res) => {
    try {
      const user = req.user?.id || req.headers["user-id"];
      const userData = await prisma.user.findUnique({
        where: { id: user },
        include: this.userInclude
      });

      if (userData) {
        return res.json({
          code: 200,
          message: "Role access fetched",
          data: this.formatDepartment(userData.EmployeeProfile_User_profileToEmployeeProfile?.department),
        });
      }
    } catch (err) {
      logger.error("Role access fetch error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  updateStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const user = await prisma.user.findUnique({ where: { id } });
      const update = await prisma.user.update({
        where: { id },
        data: { status: !user.status }
      });

      return res.json({
        code: 200,
        message: "Status updated successfully",
        data: update
      });
    } catch (err) {
      logger.error("Update status error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };
}

export default new UserController();
