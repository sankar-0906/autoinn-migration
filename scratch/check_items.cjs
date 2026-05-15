const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkInvoice() {
  const id = 'cmp53b3hx00009leggv7y7jpo';
  try {
    const invoice = await prisma.saleSpareInvoice.findUnique({
      where: { id },
      include: {
        SaleSpareInvoiceItem: {
          include: {
            partNumber: true,
            jobCode: true
          }
        }
      }
    });

    if (!invoice) {
      console.log("Invoice not found");
      return;
    }

    console.log("Invoice Items count:", invoice.SaleSpareInvoiceItem.length);
    invoice.SaleSpareInvoiceItem.forEach((item, index) => {
      console.log(`Item ${index}:`, {
        id: item.id,
        partNumberId: item.partNumberId,
        partNumberObj: item.partNumber ? "PRESENT" : "MISSING",
        partNumberString: item.partNumber?.partNumber,
        jobCodeId: item.jobCodeId,
        jobCodeObj: item.jobCode ? "PRESENT" : "MISSING"
      });
    });
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkInvoice();
