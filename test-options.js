import prisma from "./src/config/prisma.config.js";
async function test() {
  try {
    const id = "ck8g6k0a249el0880cmkbpizm";
    const vehicles = await prisma.vehicleMaster.findMany({
      where: { manufacturer: id },
      include: { Manufacturer: true, images: true, services: true, prices: true, files: true }
    });
    const result = vehicles.map(v => ({
      ...v,
      manufacturer: v.Manufacturer,
      image: v.images,
      price: v.prices,
      file: v.files
    }));
    console.log("Success! Mapped successfully.");
  } catch (err) {
    console.error("Mapping error:", err);
  }
}
test();
