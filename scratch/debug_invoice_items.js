import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkInvoice() {
  const id = 'cmp53b3hx00009leggv7y7jpo';
  const invoice = await prisma.saleSpareInvoice.findUnique({
    where: { id },
    include: {
      SaleSpareInvoiceItem: {
        include: {
          partNumber: {
            include: {
              hsn: true,
              manufacturer: true
            }
          },
          jobCode: {
            include: {
              sac: true
            }
          },
          hsn: true,
          sac: true
        }
      }
    }
  });

  console.log(JSON.stringify(invoice, null, 2));
  await prisma.$disconnect();
}

checkInvoice();
