const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { employee: true },
    include: {
      EmployeeProfile_User_profileToEmployeeProfile: {
        include: {
          documents: true
        }
      }
    },
    take: 5
  });

  console.log(JSON.stringify(users, null, 2));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
