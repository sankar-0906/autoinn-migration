import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import JWT from "../services/jwt.service.js";
import bcrypt from "bcryptjs";
import joi from "joi";
import moment from "moment";
import IdGenerateController from "./idGenerate.js";

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
            manufacturer: true, // Lowercase in Branch model
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
    manufacturer: true, // Lowercase in Branch model
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
    if (!dept) return { role: "" };
    const { RoleAccess, ...rest } = dept;
    return {
      ...rest,
      roleAccess: RoleAccess || []
    };
  }

  /**
   * Helper to format User object to match legacy fragment structure.
   */
  formatUser = (user) => {
    if (!user) return null;
    const { password, EmployeeProfile_User_profileToEmployeeProfile, ...rest } = user;
    
    let formattedUser = { ...rest };
    
    if (EmployeeProfile_User_profileToEmployeeProfile) {
      const profile = { ...EmployeeProfile_User_profileToEmployeeProfile };
      
      // Ensure branch is an array
      profile.branch = profile.branch || [];
      
      // Format department if exists
      if (profile.department) {
        profile.department = this.formatDepartment(profile.department);
      }

      // Map documents to direct fields and provide capitalized key
      if (profile.documents) {
        const docMap = {};
        profile.documents.forEach(doc => {
          const type = (doc.type || "").toLowerCase();
          if (type === "license" || type === "driving license") {
            profile.license = doc.typeValue;
            docMap.license = doc;
          }
          if (type === "pan" || type === "pan card") {
            profile.panCard = doc.typeValue;
            docMap.pan = doc;
          }
          if (type === "aadhar" || type === "aadhar card") {
            profile.aadhar = doc.typeValue;
            docMap.aadhar = doc;
          }
          if (type === "passbook") {
            docMap.passbook = doc;
          }
        });

        // Reconstruct documents array in specific order: 0:license, 1:pan, 2:aadhar, 3:passbook
        // Ensure 'files' is never null to prevent frontend crashes
        const orderedDocs = [
          docMap.license || { type: "license", typeValue: null },
          docMap.pan || { type: "pan", typeValue: null },
          docMap.aadhar || { type: "aadhar", typeValue: null },
          docMap.passbook || { type: "passbook", typeValue: null }
        ].map(doc => ({
          ...doc,
          files: doc.files || { url: null, name: doc.type }
        }));

        profile.documents = orderedDocs;
        profile.Documents = orderedDocs;
      } else {
        // Fallback for missing documents
        const defaultDocs = [
          { type: "license", typeValue: null, files: { url: null } },
          { type: "pan", typeValue: null, files: { url: null } },
          { type: "aadhar", typeValue: null, files: { url: null } },
          { type: "passbook", typeValue: null, files: { url: null } }
        ];
        profile.documents = defaultDocs;
        profile.Documents = defaultDocs;
      }

      formattedUser = {
        ...rest,
        profile
      };
    } else {
      // Fallback for users without an employee profile to prevent frontend crashes
      formattedUser.profile = {
        branch: [],
        documents: [],
        department: { role: "" }
      };
    }
    return formattedUser;
  };

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

  register = async (req, res) => {
    try {
      console.log("------------------- REGISTER START -------------------");
      const user = req.user?.id || null;
      const { body, files } = req;
      const regUserDetails = await this.createUser({
        ...body,
        files,
        user,
      });
      return res.json({
        code: 200,
        msg: "user created",
        data: regUserDetails.data
      });
    } catch (err) {
      logger.error("Register error:", err);
      if (err.code === 501) {
        return res.json({ 
          code: 501, 
          msg: "A unique constraint error occured", 
          err: { code: 501 } 
        });
      } else {
        return res.json({ 
          code: 500, 
          msg: "An error occured", 
          err: err 
        });
      }
    }
  };

  createUser = async (data) => {
    try {
      console.log("------------------- EMPLOYEE CREATION START -------------------");
      console.log("Payload:", JSON.stringify(data, null, 2));
      console.log("---------------------------------------------------------------");
      let {
        employeeId, phone, phone2 = "", profilePicture, password, status,
        profile, user, IDbranch, files, finalData
      } = data;

      // Handle both raw body and stringified finalData (from frontend FormData)
      if (finalData) {
        const parsed = Array.isArray(finalData) ? JSON.parse(finalData[0]) : JSON.parse(finalData);
        ({
          employeeId, phone, phone2 = "", profilePicture, password, status,
          profile, IDbranch
        } = parsed);
      }

      const getSingle = (val) => Array.isArray(val) ? val[val.length - 1] : val;
      employeeId = getSingle(employeeId);
      phone = getSingle(phone);
      phone2 = getSingle(phone2);
      IDbranch = getSingle(IDbranch);
      status = getSingle(status);

      const {
        documents: docs = [], employeeName, department, branch, fatherName,
        dateOfBirth, dateOfJoining, bloodGroup, bankDetails = {},
        license, panCard, aadhar
      } = profile || {};

      const documents = Array.isArray(docs) ? [...docs] : [];

      // Map direct fields to documents array if not already present
      if (license && !documents.find(d => d.type === "Driving License")) {
        documents.push({ type: "Driving License", typeValue: license });
      }
      if (panCard && !documents.find(d => d.type === "Pan Card")) {
        documents.push({ type: "Pan Card", typeValue: panCard });
      }
      if (aadhar && !documents.find(d => d.type === "Aadhar Card")) {
        documents.push({ type: "Aadhar Card", typeValue: aadhar });
      }

      const { name = "", accountName = "", ifsc = "", accountNumber = "" } = bankDetails;

      const duplicate = await prisma.user.findFirst({
        where: { phone2 }
      });

      if (duplicate) {
        throw { code: 501, msg: "Unique constraint will be violated" };
      }

      // Hash password
      const hash = await bcrypt.hash(password, 10);

      // Handle file locations (Mocking for now)
      if (Array.isArray(files) && documents && Array.isArray(documents)) {
        files.forEach(file => {
          const location = `/uploads/${file.filename}`;
          if (file.fieldname === "profilePicture") profilePicture = location;
          else {
            // Match file to document by fieldname or type
            const docIndex = documents.findIndex(d => 
              (file.fieldname === "license" && (d.type === "license" || d.type === "Driving License")) ||
              (file.fieldname === "panCard" && (d.type === "pan" || d.type === "Pan Card")) ||
              (file.fieldname === "aadhar" && (d.type === "aadhar" || d.type === "Aadhar Card")) ||
              (d.type && file.fieldname.toLowerCase().includes(d.type.toLowerCase()))
            );
            if (docIndex !== -1) {
              documents[docIndex].files = { url: location };
            }
          }
        });
      }

      console.log("Documents to be saved (create):", JSON.stringify(documents, null, 2));

      const dob = dateOfBirth ? moment(dateOfBirth, ["DD-MM-YYYY", "YYYY-MM-DD"]).toDate() : null;
      const doj = dateOfJoining ? moment(dateOfJoining, ["DD-MM-YYYY", "YYYY-MM-DD"]).toDate() : null;

      const createdUser = await prisma.user.create({
        data: {
          phone,
          phone2,
          employee: true,
          password: hash,
          profilePicture,
          status: status === "true" || status === true,
          createdAt: new Date(),
          updatedAt: new Date(),
          EmployeeProfile_User_profileToEmployeeProfile: {
            create: {
              employeeId,
              employeeName,
              fatherName,
              dateOfBirth: dob,
              dateOfJoining: doj,
              bloodGroup,
              createdAt: new Date(),
              updatedAt: new Date(),
              department: department ? { connect: { id: department } } : undefined,
              branch: (branch && branch.length > 0) ? {
                connect: branch.map(id => ({ id }))
              } : { connect: { id: "ck8g589vj499008806oh90nmx" } }, // Default: Devanahalli
              bankDetails: {
                create: {
                  name,
                  accountName,
                  ifsc: ifsc.toUpperCase(),
                  accountNumber,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                }
              },
              documents: documents && documents.length > 0 ? {
                create: documents.map(doc => ({
                  type: doc.type,
                  typeValue: doc.typeValue,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  files: doc.files?.url ? {
                    create: {
                      name: doc.files.name || "document",
                      entity: "User Document",
                      url: doc.files.url,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    }
                  } : undefined
                }))
              } : undefined
            }
          },
          createdBy: user ? { connect: { id: user } } : undefined
        },
        include: this.userInclude
      });

      // ID Generation logic (Employee ID increment)
      await IdGenerateController.incrementId("EMPLOYEE", IDbranch);

      return {
        code: 200,
        message: "user created",
        data: this.formatUser(createdUser),
      };
    } catch (err) {
      logger.error("Create user error:", err);
      throw err;
    }
  };

  updateUser = async (req, res) => {
    try {
      const { id } = req.params;
      const { body, files } = req;
      
      console.log("------------------- EMPLOYEE UPDATE START -------------------");
      console.log("ID:", id);
      console.log("Payload:", JSON.stringify(body, null, 2));
      console.log("-------------------------------------------------------------");

      let {
        employeeId, phone, phone2 = "", profilePicture, password, status,
        profile, IDbranch, finalData
      } = body;

      // Handle both raw body and stringified finalData (from frontend FormData)
      if (finalData) {
        const parsed = Array.isArray(finalData) ? JSON.parse(finalData[0]) : JSON.parse(finalData);
        ({
          employeeId, phone, phone2 = "", profilePicture, password, status,
          profile, IDbranch
        } = parsed);
      }

      const getSingle = (val) => Array.isArray(val) ? val[val.length - 1] : val;
      employeeId = getSingle(employeeId);
      phone = getSingle(phone);
      phone2 = getSingle(phone2);
      IDbranch = getSingle(IDbranch);
      status = getSingle(status);

      const {
        documents: docs = [], employeeName, department, branch, fatherName,
        dateOfBirth, dateOfJoining, bloodGroup, bankDetails = {},
        license, panCard, aadhar
      } = profile || {};

      const documents = Array.isArray(docs) ? [...docs] : [];

      // Map direct fields to documents array if not already present
      if (license && !documents.find(d => d.type === "Driving License")) {
        documents.push({ type: "Driving License", typeValue: license });
      }
      if (panCard && !documents.find(d => d.type === "Pan Card")) {
        documents.push({ type: "Pan Card", typeValue: panCard });
      }
      if (aadhar && !documents.find(d => d.type === "Aadhar Card")) {
        documents.push({ type: "Aadhar Card", typeValue: aadhar });
      }

      const { name = "", accountName = "", ifsc = "", accountNumber = "" } = bankDetails;

      // Handle file locations (Mocking for now)
      if (Array.isArray(files) && documents && Array.isArray(documents)) {
        files.forEach(file => {
          const location = `/uploads/${file.filename}`;
          if (file.fieldname === "profilePicture") profilePicture = location;
          else {
            // Match file to document by fieldname or type
            const docIndex = documents.findIndex(d => 
              (file.fieldname === "license" && (d.type === "license" || d.type === "Driving License")) ||
              (file.fieldname === "panCard" && (d.type === "pan" || d.type === "Pan Card")) ||
              (file.fieldname === "aadhar" && (d.type === "aadhar" || d.type === "Aadhar Card")) ||
              (d.type && file.fieldname.toLowerCase().includes(d.type.toLowerCase()))
            );
            if (docIndex !== -1) {
              documents[docIndex].files = { url: location };
            }
          }
        });
      }

      console.log("Documents to be saved (update):", JSON.stringify(documents, null, 2));

      const dob = dateOfBirth ? moment(dateOfBirth, ["DD-MM-YYYY", "YYYY-MM-DD"]).toDate() : undefined;
      const doj = dateOfJoining ? moment(dateOfJoining, ["DD-MM-YYYY", "YYYY-MM-DD"]).toDate() : undefined;

      const updateData = {
        phone,
        phone2,
        profilePicture,
        status: status === "true" || status === true,
        updatedAt: new Date(),
        EmployeeProfile_User_profileToEmployeeProfile: {
          update: {
            employeeId,
            employeeName,
            fatherName,
            dateOfBirth: dob,
            dateOfJoining: doj,
            bloodGroup,
            updatedAt: new Date(),
            department: department ? { connect: { id: department } } : { disconnect: true },
            branch: branch && branch.length > 0 ? {
              set: branch.map(id => ({ id }))
            } : undefined,
            bankDetails: {
              upsert: {
                create: {
                  name,
                  accountName,
                  ifsc: ifsc ? ifsc.toUpperCase() : "",
                  accountNumber,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
                update: {
                  name,
                  accountName,
                  ifsc: ifsc ? ifsc.toUpperCase() : "",
                  accountNumber,
                  updatedAt: new Date(),
                }
              }
            },
            documents: documents && documents.length > 0 ? {
              deleteMany: {},
              create: documents.map(doc => ({
                type: doc.type,
                typeValue: doc.typeValue,
                createdAt: new Date(),
                updatedAt: new Date(),
                files: doc.files?.url ? {
                  create: {
                    name: doc.files.name || "document",
                    entity: "User Document",
                    url: doc.files.url,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  }
                } : undefined
              }))
            } : undefined
          }
        }
      };

      if (password && password !== "") {
        updateData.password = await bcrypt.hash(password, 10);
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
        include: this.userInclude
      });

      return res.json({
        code: 200,
        msg: "user updated",
        data: this.formatUser(updatedUser)
      });
    } catch (err) {
      logger.error("Update user error:", err);
      return res.json({ code: 500, msg: "An error occured", err });
    }
  };

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
            msg: "User does not exist!",
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
            msg: "Password Does not match",
            data: null,
          }
        });
      }

      if (user.status === false) {
        return res.json({
          code: 200,
          response: {
            code: 404,
            msg: "This user is inactive",
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
          msg: "USER_LOGGED_IN",
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
          msg: "user fetched",
          data: this.formatUser(response),
        }
      });
    } catch (err) {
      logger.error("Current user error:", err);
      return res.json({ code: 500, msg: "an error occured" });
    }
  };

  getUsersCount = async (req, res) => {
    try {
      const count = await prisma.user.count();
      return res.json({
        code: 200,
        msg: "users fetched",
        count: count
      });
    } catch (err) {
      logger.error("Get user count error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getAllUsers = async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        include: this.userInclude
      });
      return res.json({
        code: 200,
        msg: "user fetched",
        data: {
          users: users.map(u => this.formatUser(u))
        }
      });
    } catch (err) {
      logger.error("Get all users error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  token = async (req, res) => {
    try {
      const { branch } = req.body;
      const user = req.user?.id || req.headers["user-id"];
      
      const payload = {
        id: user,
        branch: branch
      };
      
      const token = await JWT.sign(payload, "2d");
      
      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Token created",
          data: token
        }
      });
    } catch (err) {
      logger.error("Token creation error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getUser = async (req, res) => {
    try {
      const { id } = req.params;
      const user = await prisma.user.findUnique({
        where: { id },
        include: this.userInclude
      });

      if (!user) {
        return res.json({ code: 404, message: "User not found" });
      }

      return res.json({
        code: 200,
        message: "user fetched",
        data: this.formatUser(user)
      });
    } catch (err) {
      logger.error("Get user error:", err);
      return res.json({ code: 500, message: "error fetching user" });
    }
  };

  department = async (req, res) => {
    try {
      const dept = await prisma.department.findMany();
      return res.json({
        code: 200,
        msg: "departments fetched",
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
        msg: "branches fetched",
        data: branches.map(b => b ? this.formatBranch(b) : null),
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
          msg: "Role access fetched",
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
        msg: "Status updated successfully",
        data: update
      });
    } catch (err) {
      logger.error("Update status error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };
  getPage = async (req, res) => {
    try {
      const { manager = true, searchString, page, size, branch } = req.body;
      const user = req.user?.id;
      
      // Priority: branch from body -> branch from token (user.branch)
      let branchArr = [];
      if (branch) {
        branchArr = Array.isArray(branch) ? branch : [branch];
      } else {
        const branchIds = req.user?.branch || [];
        branchArr = Array.isArray(branchIds) ? branchIds : [branchIds];
      }
      
      // Pagination handling: if size is missing, return all (parity with legacy Prisma 1)
      const parsedPage = parseInt(page) || 1;
      const parsedSize = size ? parseInt(size) : undefined;
      const skip = parsedSize ? (parsedPage - 1) * parsedSize : undefined;
      const inputValue = searchString || "";

      if (!manager) {
        const currentUser = await prisma.user.findUnique({
          where: { id: user },
          include: this.userInclude
        });
        if (currentUser) {
          return res.json({
            code: 200,
            response: {
              code: 200,
              msg: "Current user fetched",
              data: { count: 1, users: [this.formatUser(currentUser)], user }
            }
          });
        }
        return res.json({
          code: 404,
          msg: "User not found",
          data: { count: 0, users: [], user }
        });
      }

      const where = {
        employee: true,
        EmployeeProfile_User_profileToEmployeeProfile: {
          branch: { some: { id: { in: branchArr } } }
        },
        OR: [
          { phone: { contains: inputValue, mode: 'insensitive' } },
          { EmployeeProfile_User_profileToEmployeeProfile: { employeeName: { contains: inputValue, mode: 'insensitive' } } },
          { EmployeeProfile_User_profileToEmployeeProfile: { employeeId: { contains: inputValue, mode: 'insensitive' } } }
        ]
      };

      const [users, count] = await Promise.all([
        prisma.user.findMany({
          where,
          take: parsedSize,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.userInclude
        }),
        prisma.user.count({ where })
      ]);

      console.log(`GET USER PAGE: found ${users.length} users for branches: ${branchArr}`);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Users fetched",
          data: { count, users: users.map(u => this.formatUser(u)), user }
        }
      });
    } catch (err) {
      logger.error("Get user page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };
  getEmployee = async (req, res) => {
    try {
      const { searchString, page, size, branch } = req.body;
      const user = req.user?.id;
      
      let branchArr = [];
      if (branch) {
        branchArr = Array.isArray(branch) ? branch : [branch];
      } else {
        const branchIds = req.user?.branch || [];
        branchArr = Array.isArray(branchIds) ? branchIds : [branchIds];
      }

      const parsedPage = parseInt(page) || 1;
      const parsedSize = size ? parseInt(size) : undefined;
      const skip = parsedSize ? (parsedPage - 1) * parsedSize : undefined;
      const inputValue = searchString || "";

      const where = {
        employee: true,
        EmployeeProfile_User_profileToEmployeeProfile: {
          branch: { some: { id: { in: branchArr } } }
        },
        OR: [
          { phone: { contains: inputValue, mode: 'insensitive' } },
          { EmployeeProfile_User_profileToEmployeeProfile: { employeeName: { contains: inputValue, mode: 'insensitive' } } },
          { EmployeeProfile_User_profileToEmployeeProfile: { employeeId: { contains: inputValue, mode: 'insensitive' } } }
        ]
      };

      const users = await prisma.user.findMany({
        where,
        take: parsedSize,
        skip,
        orderBy: { createdAt: 'desc' },
        include: this.userInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Employees fetched",
          data: users.map(u => this.formatUser(u))
        }
      });
    } catch (err) {
      logger.error("Get employee error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };



  deleteUser = async (req, res) => {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          EmployeeProfile_User_profileToEmployeeProfile: {
            include: {
              documents: true
            }
          }
        }
      });

      if (!user) {
        return res.json({ code: 404, message: "User not found" });
      }

      // Perform deletion in a transaction to ensure integrity
      await prisma.$transaction(async (tx) => {
        // 1. Delete documents and their files
        const profile = user.EmployeeProfile_User_profileToEmployeeProfile;
        if (profile?.documents) {
          for (const doc of profile.documents) {
            if (doc.filesId) {
              await tx.file.delete({ where: { id: doc.filesId } }).catch(() => {});
            }
          }
          await tx.employeeDocument.deleteMany({
            where: { userProfileId: user.profile }
          });
        }

        // 2. Delete the User
        await tx.user.delete({ where: { id } });

        // 3. Delete the EmployeeProfile if it exists
        if (user.profile) {
          if (profile.bankDetailsId) {
            await tx.bankDetails.delete({ where: { id: profile.bankDetailsId } }).catch(() => {});
          }
          if (profile.addressId) {
            await tx.address.delete({ where: { id: profile.addressId } }).catch(() => {});
          }
          await tx.employeeProfile.delete({ where: { id: user.profile } });
        }
      });

      return res.json({
        code: 200,
        msg: "User deleted successfully"
      });
    } catch (err) {
      logger.error("Delete user error:", err);
      return res.json({ 
        code: 500, 
        msg: "An error occured", 
        err 
      });
    }
  };
}

export default new UserController();
