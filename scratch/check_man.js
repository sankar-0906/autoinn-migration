import prisma from '../src/config/prisma.config.js';

async function check() {
  try {
    const man = await prisma.manufacturer.findUnique({
      where: { id: 'ck8g6k0a249el0880cmkbpizm' }
    });
    console.log('Manufacturer exists:', !!man);
  } catch (err) {
    console.error('Error checking manufacturer:', err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
