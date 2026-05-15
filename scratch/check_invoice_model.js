import prisma from '../src/config/prisma.config.js';

async function main() {
  const id = "cmp53b3hx00009leggv7y7jpo";
  const ssi = await prisma.saleSpareInvoice.findUnique({ where: { id } });
  const ji = await prisma.jobInvoice.findUnique({ where: { id } });
  
  console.log("SaleSpareInvoice:", ssi ? "Found" : "Not Found");
  console.log("JobInvoice:", ji ? "Found" : "Not Found");
}

main().catch(console.error).finally(() => prisma.$disconnect());
