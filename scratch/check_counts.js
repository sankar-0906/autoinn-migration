import prisma from '../src/config/prisma.config.js';

async function main() {
  const orphaned = await prisma.frameNumber.findMany({
    where: { manufacturerId: null },
    include: { manufacturer: true }
  });
  console.log('Orphaned Records:', JSON.stringify(orphaned, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
