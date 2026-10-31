#!/usr/bin/env bash
set -eo pipefail

echo "=========================================================="
echo " QELEM FEED REBUILD JOB"
echo " Enqueuing background rebuild jobs for active users..."
echo "=========================================================="

node -e '
import("../server/dist/config/db.js").then(async ({ connectDB, disconnectDB }) => {
  await connectDB();
  const { User } = await import("../server/dist/models/User.js");
  const { rebuildQueue } = await import("../server/dist/services/queue.service.js");
  
  const activeUsers = await User.find({ state: "active" }).select("_id").lean();
  console.log(`Found ${activeUsers.length} active users to rebuild.`);
  
  for (const u of activeUsers) {
    await rebuildQueue.add("rebuild-feed", { userId: u._id.toString() });
  }
  
  console.log("All feed rebuild jobs successfully dispatched to BullMQ.");
  await disconnectDB();
  process.exit(0);
});
' || echo "Rebuild script executed"
