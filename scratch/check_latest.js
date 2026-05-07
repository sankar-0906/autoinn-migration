
import prisma from '../src/config/prisma.config.js';

async function main() {
  const manufacturers = await prisma.manufacturer.findMany({
    orderBy: {
      createdAt: 'desc'
    },
    take: 5,
    include: {
      branches: true,
      address: true
    }
  });
  console.log(JSON.stringify(manufacturers, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
