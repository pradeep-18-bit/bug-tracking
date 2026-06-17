const { createClient } = require("redis");

const client = createClient({
  url: process.env.REDIS_URL || "redis://redis:6379",
});

client.on("error", (err) => {
  console.error("Redis Error:", err);
});

(async () => {
  try {
    await client.connect();
    console.log("Redis Connected");
  } catch (err) {
    console.error("Redis Connection Failed:", err);
  }
})();

module.exports = client;
