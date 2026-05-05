import prisma from '../src/config/prisma.config.js';

async function insert() {
  const addressId = 'cmogretgvh3z40852znx2v18v';
  const manufacturerId = 'ck8g6k0a249el0880cmkbpizm';

  try {
    // 1. Upsert dummy address to satisfy FK
    await prisma.address.upsert({
      where: { id: addressId },
      update: {},
      create: {
        id: addressId,
        line1: 'Imported Address',
        locality: 'Unknown',
        pincode: '000000',
        createdAt: new Date('2020-03-31T17:33:30.602Z'),
        updatedAt: new Date('2026-04-27T05:31:25.959Z'),
      }
    });

    // 2. Create manufacturer
    const created = await prisma.manufacturer.create({
      data: {
        id: manufacturerId,
        name: 'India Yamaha Motors Private Limited',
        logo: 'https://autocloudstorage.sgp1.digitaloceanspaces.com/testing/Company%20Master/Manufacturer/India%20Yamaha%20Motors%20Private%20Limited/Logo/IMG-1737118009183-RevampLogo.png',
        email: 'yes@yamaha-motor-india.com',
        createdAt: new Date('2020-03-31T17:33:30.602Z'),
        updatedAt: new Date('2026-04-27T05:31:25.959Z'),
        addressId: addressId,
        code: 'ME1',
        gst: '29AAECN9449B1Z8',
        vehicleManufacturer: true
      }
    });

    console.log('Manufacturer inserted successfully:', created.id);
  } catch (err) {
    console.error('Error inserting data:', err);
  } finally {
    await prisma.$disconnect();
  }
}

insert();
