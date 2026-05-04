import prisma from '../src/config/prisma.config.js';

async function check() {
  try {
    const address = await prisma.address.findUnique({
      where: { id: 'cmogretgvh3z40852znx2v18v' }
    });
    console.log('Address exists:', !!address);
    if (address) {
       console.log('Address details:', JSON.stringify(address, null, 2));
    }
  } catch (err) {
    console.error('Error checking address:', err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
