import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";
import axios from "axios";

/**
 * Controller for Company and Branch operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class CompanyController {
  // Shared include object for Branch to mirror legacy fragment
  branchInclude = {
    company: true,
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
    personInCharge: {
      include: {
        EmployeeProfile_User_profileToEmployeeProfile: true
      }
    }
  };

  /**
   * Helper to format Branch object to match legacy fragment structure
   */
  formatBranch(branch) {
    if (!branch) return null;
    const { personInCharge, ...rest } = branch;
    return {
      ...rest,
      personInCharge: personInCharge ? personInCharge.map(p => ({
        id: p.id,
        phone: p.phone,
        phone2: p.phone2,
        profile: p.EmployeeProfile_User_profileToEmployeeProfile ? {
          id: p.EmployeeProfile_User_profileToEmployeeProfile.id,
          employeeName: p.EmployeeProfile_User_profileToEmployeeProfile.employeeName
        } : null
      })) : []
    };
  }

  createCompany = async (req, res) => {
    try {
      const { name, cin, pan, website, email, contactPerson, phone } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const createCompany = await prisma.company.create({
        data: {
          name,
          cin,
          pan,
          website,
          email,
          contactPerson,
          phone,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "company created successfully",
          data: createCompany
        }
      });
    } catch (err) {
      logger.error("Create company error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getAll = async (req, res) => {
    try {
      const companies = await prisma.company.findMany();
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "companies fetched",
          data: companies
        }
      });
    } catch (err) {
      logger.error("Get all companies error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const company = await prisma.company.findUnique({
        where: { id }
      });
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "company fetched",
          data: company
        }
      });
    } catch (err) {
      logger.error("Get one company error:", err);
      return res.json({ code: 500, message: "Server error, Please check the logs" });
    }
  };

  updateCompany = async (req, res) => {
    try {
      const { id } = req.params;
      const { name, cin, pan, website, email, logo, contact_person, phone } = req.body;
      const updated = await prisma.company.update({
        where: { id },
        data: {
          name, cin, pan, website, email, logo, contactPerson: contact_person, phone,
          updatedAt: new Date()
        }
      });
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "company updated",
          data: updated
        }
      });
    } catch (err) {
      logger.error("Update company error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  deleteCompany = async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await prisma.company.delete({
        where: { id }
      });
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Company deleted permanently."
        }
      });
    } catch (err) {
      logger.error("Delete company error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  senderId = async (req, res) => {
    try {
      if (!process.env.ADMIN_API_KEY) {
        logger.warn("ADMIN_API_KEY missing, returning mock sender IDs");
        return res.json({
          code: 200,
          response: {
            code: 200,
            msg: "Sender Id's fetched (Mock)",
            data: ["AUTOIN", "SMSTST"]
          }
        });
      }

      const response = await axios.get("http://admin.autocloud.in/api/v1/smsApi/senderId", {
        headers: {
          'Authorization': process.env.ADMIN_API_KEY
        }
      });
      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Sender Id's fetched",
          data: response.data.senderId
        }
      });
    } catch (err) {
      logger.error("Sender ID error:", err.message);
      return res.json({ 
        code: 200, 
        response: {
          code: 200,
          msg: "Sender Id's fetched (Fallback)",
          data: ["AUTOIN"]
        }
      });
    }
  };

  createBranch = async (req, res) => {
    try {
      console.log("createBranch Payload:", req.body);
      const {
        name, branchType, noOfRamps, contacts, gst, email = '',
        url = '', googleMapUrl = '', manufacturer, personInCharge,
        lat, lon, address, bankDetails, latitude, longitude, senderId
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const reqLat = latitude || lat || address?.latitude || address?.lat;
      const reqLon = longitude || lon || address?.longitude || address?.lon;
      const parsedLat = reqLat ? parseFloat(reqLat) : null;
      const parsedLon = reqLon ? parseFloat(reqLon) : null;

      // Fetch first company as per legacy logic
      const companies = await prisma.company.findMany({ take: 1 });
      if (companies.length === 0) {
        return res.json({ code: 500, msg: "No company found to associate branch" });
      }
      const companyId = companies[0].id;

      const created = await prisma.branch.create({
        data: {
          name,
          branchType,
          noOfRamps: noOfRamps ? parseInt(noOfRamps) : 0,
          lat: parsedLat,
          lon: parsedLon,
          gst,
          senderId,
          email,
          url,
          googleMapUrl,
          createdAt: new Date(),
          updatedAt: new Date(),
          company: { connect: { id: companyId } },
          address: {
            create: {
              line1: address?.line1,
              line2: address?.line2,
              line3: address?.line3,
              locality: address?.locality,
              pincode: address?.pincode,
              createdAt: new Date(),
              updatedAt: new Date(),
              district: address?.district ? { connect: { id: address.district } } : undefined,
              state: address?.state ? { connect: { id: address.state } } : undefined,
              country: address?.country ? { connect: { id: address.country } } : undefined,
            }
          },
          contacts: contacts && contacts.length > 0 ? {
            create: contacts.map(c => ({
              phone: c.phone,
              category: c.category,
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          } : undefined,
          bankDetails: bankDetails && bankDetails.length > 0 ? {
            create: bankDetails.map(b => ({
              name: b.name,
              accountName: b.accountName,
              ifsc: b.ifsc,
              accountNumber: b.accountNumber,
              accountType: b.accountType,
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          } : undefined,
          manufacturer: manufacturer && manufacturer.length > 0 ? {
            connect: manufacturer.map(id => ({ id }))
          } : undefined,
          personInCharge: personInCharge && personInCharge.length > 0 ? {
            connect: personInCharge.map(id => ({ id }))
          } : undefined,
          createdBy: user ? { connect: { id: user } } : undefined
        },
        include: this.branchInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Branch created successfully",
          data: this.formatBranch(created)
        }
      });
    } catch (err) {
      logger.error("Create branch error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  getBranches = async (req, res) => {
    try {
      const branches = await prisma.branch.findMany({
        include: this.branchInclude
      });
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Branches fetched",
          data: branches.map(b => this.formatBranch(b))
        }
      });
    } catch (err) {
      logger.error("Get branches error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page, size, searchString } = req.body;
      const skip = (page - 1) * size;
      const inputValue = searchString || "";
      const tCased = await titleCase(inputValue);

      const where = {
        OR: [
          { name: { contains: inputValue, mode: 'insensitive' } },
          { name: { contains: tCased, mode: 'insensitive' } }
        ]
      };

      const [branches, count] = await Promise.all([
        prisma.branch.findMany({
          where,
          take: size,
          skip,
          include: {
            ...this.branchInclude,
            employeeProfiles: {
              select: { id: true, employeeName: true, User_User_profileToEmployeeProfile: { select: { status: true } } }
            }
          }
        }),
        prisma.branch.count({ where })
      ]);

      const formattedBranches = branches.map(b => {
        const activeCount = b.employeeProfiles.filter(p => p.User_User_profileToEmployeeProfile[0]?.status === true).length;
        const inactiveCount = b.employeeProfiles.length - activeCount;
        
        return {
          ...this.formatBranch(b),
          count: activeCount,
          inactiveCount,
          totalCount: b.employeeProfiles.length
        };
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Branches  fetched",
          data: { count, branch: formattedBranches }
        }
      });
    } catch (err) {
      logger.error("Get branch page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };

  updateBranch = async (req, res) => {
    try {
      console.log("updateBranch Payload:", req.body);
      const { id } = req.params;
      const {
        name, branchType, noOfRamps, contacts, gst, email = '',
        url = '', googleMapUrl = '', manufacturer, personInCharge,
        lat, lon, address, bankDetails, latitude, longitude, senderId
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const reqLat = latitude || lat || address?.latitude || address?.lat;
      const reqLon = longitude || lon || address?.longitude || address?.lon;
      const parsedLat = reqLat ? parseFloat(reqLat) : null;
      const parsedLon = reqLon ? parseFloat(reqLon) : null;

      const updated = await prisma.branch.update({
        where: { id },
        data: {
          name,
          branchType,
          noOfRamps: noOfRamps ? parseInt(noOfRamps) : 0,
          lat: parsedLat,
          lon: parsedLon,
          gst,
          senderId,
          email,
          url,
          googleMapUrl,
          updatedAt: new Date(),
          address: {
            update: {
              line1: address?.line1,
              line2: address?.line2,
              line3: address?.line3,
              locality: address?.locality,
              pincode: address?.pincode,
              district: address?.district ? { connect: { id: address.district } } : undefined,
              state: address?.state ? { connect: { id: address.state } } : undefined,
              country: address?.country ? { connect: { id: address.country } } : undefined,
              updatedAt: new Date()
            }
          },
          contacts: contacts && contacts.length > 0 ? {
            upsert: contacts.filter(c => c.id).map(c => ({
              where: { id: c.id },
              update: { phone: c.phone, category: c.category, updatedAt: new Date() },
              create: { phone: c.phone, category: c.category, createdAt: new Date(), updatedAt: new Date() }
            })),
            create: contacts.filter(c => !c.id).map(c => ({
              phone: c.phone, category: c.category, createdAt: new Date(), updatedAt: new Date()
            }))
          } : undefined,
          bankDetails: bankDetails && bankDetails.length > 0 ? {
            upsert: bankDetails.filter(b => b.id).map(b => ({
              where: { id: b.id },
              update: { name: b.name, accountName: b.accountName, ifsc: b.ifsc, accountNumber: b.accountNumber, accountType: b.accountType, updatedAt: new Date() },
              create: { name: b.name, accountName: b.accountName, ifsc: b.ifsc, accountNumber: b.accountNumber, accountType: b.accountType, createdAt: new Date(), updatedAt: new Date() }
            })),
            create: bankDetails.filter(b => !b.id).map(b => ({
              name: b.name, accountName: b.accountName, ifsc: b.ifsc, accountNumber: b.accountNumber, accountType: b.accountType, createdAt: new Date(), updatedAt: new Date()
            }))
          } : undefined,
          manufacturer: manufacturer ? {
            set: manufacturer.map(mid => ({ id: mid }))
          } : undefined,
          personInCharge: personInCharge ? {
            set: personInCharge.map(pid => ({ id: pid }))
          } : undefined
        },
        include: this.branchInclude
      });

      const activeUsersCount = await prisma.user.count({
        where: {
          status: true,
          EmployeeProfile_User_profileToEmployeeProfile: {
            branch: { some: { id } }
          }
        }
      });
      const formattedBranch = this.formatBranch(updated);
      formattedBranch.count = activeUsersCount;

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Branch updated successfully",
          data: formattedBranch
        }
      });
    } catch (err) {
      logger.error("Update branch error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  delBranches = async (req, res) => {
    try {
      const { id } = req.params;
      const count = await prisma.branch.count();
      if (count === 1) {
        return res.json({
          code: 200,
          response: {
            code: 300,
            message: "There is only one branch present"
          }
        });
      }
      await prisma.branch.delete({ where: { id } });
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Branch deleted permanently."
        }
      });
    } catch (err) {
      logger.error("Delete branch error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  delBank = async (req, res) => {
    try {
      const { id } = req.params;
      await prisma.bankDetails.delete({ where: { id } });
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Bank deleted permanently."
        }
      });
    } catch (err) {
      logger.error("Delete bank error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  deleteBranchContact = async (req, res) => {
    try {
      const { id } = req.params;
      await prisma.branchContacts.delete({ where: { id } });
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Branch Contact deleted permanently."
        }
      });
    } catch (err) {
      logger.error("Delete branch contact error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getCompanyByBranch = async (req, res) => {
    try {
      const { branchId } = req.params;
      // Mirroring the SQL logic from legacy getCompany
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        include: { company: true }
      });

      if (branch?.company) {
        return res.json({
          code: 200,
          message: "Branches fetched",
          data: branch.company
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get company by branch error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };
}

export default new CompanyController();
