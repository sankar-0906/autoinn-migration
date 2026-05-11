import prisma from '../src/config/prisma.config.js';

async function check() {
  const duplicates = await prisma.$queryRawUnsafe(`
    SELECT "invoiceNumber", COUNT(*) 
    FROM "PurchaseSpareInvoice" 
    GROUP BY "invoiceNumber" 
    HAVING COUNT(*) > 1
  `);
  console.log('Duplicate Invoice Numbers:', duplicates);

  const count = await prisma.purchaseSpareInvoice.count();
  console.log('Total PSI count:', count);
  
  const last = await prisma.purchaseSpareInvoice.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  console.log('Last PSI:', last);
}

check().catch(console.error).finally(() => prisma.$disconnect());
