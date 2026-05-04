import prisma from "./src/config/prisma.config.js";
async function test() {
  try {
    const vehicles = await prisma.vehicleMaster.findMany({
      where: { manufacturer: "ck8g6k0a249el0880cmkbpizm" },
      include: { Manufacturer: true, images: true, services: true, prices: true, files: true }
    });
    console.log("Success! Vehicles found:", vehicles.length);
  } catch (err) {
    console.error("Prisma error:", err);
  }
}
test();
