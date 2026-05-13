import prisma from "../src/config/prisma.config.js";

async function cleanupDuplicateEstimates() {
  try {
    console.log("Starting Estimate duplicate cleanup...");

    // 1. Get all estimates grouped by jobOrderId
    const estimates = await prisma.estimate.findMany({
      select: { id: true, jobOrderId: true, createdAt: true },
      orderBy: { createdAt: "desc" }
    });

    const jobMap = new Map();
    const toDelete = [];

    for (const est of estimates) {
      if (!est.jobOrderId) continue;

      if (!jobMap.has(est.jobOrderId)) {
        // Keep the first (latest) one
        jobMap.set(est.jobOrderId, est.id);
      } else {
        // Mark others for deletion
        toDelete.push(est.id);
      }
    }

    console.log(`Found ${toDelete.length} duplicate estimates to delete.`);

    if (toDelete.length > 0) {
      // Delete items first to maintain referential integrity (if not cascade)
      // Implicit join table records are cleaned up automatically by Prisma
      
      // Get all item IDs linked to these estimates
      const itemsToDelete = await prisma.estimateItem.findMany({
        where: { Estimate: { some: { id: { in: toDelete } } } }
      });

      console.log(`Deleting ${itemsToDelete.length} items associated with duplicate estimates.`);
      
      await prisma.estimate.deleteMany({
        where: { id: { in: toDelete } }
      });
      
      // Also delete the items themselves if they are orphans
      // Actually, in this project, items are usually linked to one estimate
      await prisma.estimateItem.deleteMany({
        where: { id: { in: itemsToDelete.map(i => i.id) } }
      });
    }

    console.log("Cleanup complete.");
    process.exit(0);
  } catch (err) {
    console.error("Cleanup failed:", err);
    process.exit(1);
  }
}

cleanupDuplicateEstimates();
