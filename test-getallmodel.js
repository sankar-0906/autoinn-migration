import prisma from "./src/config/prisma.config.js";
import VehicleMasterController from "./src/controllers/vehicleMaster.js";

async function test() {
  try {
    const id = "ck8g6k0a249el0880cmkbpizm";
    const where = {
      manufacturer: id,
      vehicleStatus: undefined,
      OR: [
        { modelName: { contains: "", mode: 'insensitive' } },
        { modelCode: { contains: "", mode: 'insensitive' } }
      ]
    };

    const models = await prisma.vehicleMaster.findMany({
      where,
      include: VehicleMasterController.vehicleMasterInclude
    });

    console.log("Success! Models found:", models.length);
    const formatted = models.map(v => VehicleMasterController.formatVehicleMaster(v));
    console.log("Formatted:", formatted.length);
  } catch (err) {
    console.error("Prisma or Mapping error:", err);
  }
}
test();
