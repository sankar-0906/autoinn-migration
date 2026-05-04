import prisma from "./src/config/prisma.config.js";

async function test() {
  try {
    const ids = ["cmmowba73ei7a0852njk26zlq"];
    const customers = await prisma.customer.findMany({
      where: { id: { in: ids } },
      include: {
        quotation: {
          include: {
            QuotationVehicle: {
              include: {
                vehicleDetail: {
                  include: {
                    Manufacturer: true,
                    images: true,
                    prices: true
                  }
                }
              }
            },
            executive: true
          }
        },
        purchasedVehicles: true
      }
    });

    console.log("findMany succeeded", customers.length);

    let purchasedVehicle = [];
    let quotation = [];

    customers.forEach(c => {
      if (c.quotation) quotation = quotation.concat(c.quotation);
      if (c.purchasedVehicles) purchasedVehicle = purchasedVehicle.concat(c.purchasedVehicles);
    });

    // Deduplicate by ID
    quotation = Array.from(new Set(quotation.map(q => q.id)))
      .map(id => quotation.find(q => q.id === id))
      .map(q => ({
        ...q,
        vehicle: q.QuotationVehicle?.length > 0 ? {
            ...q.QuotationVehicle[0],
            vehicleDetail: q.QuotationVehicle[0].vehicleDetail ? {
                ...q.QuotationVehicle[0].vehicleDetail,
                manufacturer: q.QuotationVehicle[0].vehicleDetail.Manufacturer,
                image: q.QuotationVehicle[0].vehicleDetail.images,
                price: q.QuotationVehicle[0].vehicleDetail.prices
            } : null
        } : null
      }));

    purchasedVehicle = Array.from(new Set(purchasedVehicle.map(v => v.id)))
      .map(id => purchasedVehicle.find(v => v.id === id));

    console.log("Successfully formatted!");
  } catch (err) {
    console.error("Crash error:");
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
