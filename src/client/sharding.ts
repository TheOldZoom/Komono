import { ClusterManager } from "status-sharding";
import { Env } from "utils/env";
import { Log } from "utils/log";

const client = "src/client/app.ts";
const token = Env.Required("token").ToString();

Log.Write("Starting Discord bot with sharding...", "blue");

const manager = new ClusterManager(client, {
  mode: "process",
  token: token,
  // shardsPerClusters: 4,
  respawn: true,
  heartbeat: {
    enabled: true,
    maxMissedHeartbeats: 2,
    interval: 1000 * 10,
    timeout: 1000 * 12,
  },
  spawnOptions: {
    delay: 6000,
  },
});

process.on("uncaughtException", (error) => {
  Log.Write(`Uncaught Exception: ${error}`, "red");
  console.error(error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error(reason);
  Log.Write(
    `Unhandled Rejection at: ${promise} with the reason: ${reason}`,
    "red"
  );
});

process.on("warning", (warning) => {
  Log.Write(`WARNING: ${warning.name} : ${warning.message}`, "red");
});

manager.on("clusterCreate", (cluster) => {
  Log.Write(`Creating cluster ${cluster.id}...`, "yellow");

  cluster.on("ready", () => {
    Log.Write(`Cluster ${cluster.id} is ready!`, "green");
  });

  cluster.on("death", (cluster) => {
    Log.Write(`Cluster ${cluster.id} died.`, "red");
  });
});

manager.on("spawn", (cluster: any) => {
  Log.Write(`Spawning cluster ${cluster.id}...`, "blue");
});

try {
  await manager.spawn();
  Log.Write("All clusters spawned successfully!", "green");
} catch (error) {
  Log.Write(`Failed to spawn clusters: ${error}`, "red");
  console.error(error);
  process.exit(1);
}
