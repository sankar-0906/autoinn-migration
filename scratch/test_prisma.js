import prisma from '../src/config/prisma.config.js';

async function test() {
  try {
    const dept = await prisma.department.findFirst();
    console.log('Department fetched successfully:', dept?.id);
    console.log('Department type:', dept?.departmentType);
  } catch (err) {
    console.error('Prisma test error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
