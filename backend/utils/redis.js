const Redis = require("ioredis");

const parseRedisPort = (value, fallback = 6379) => {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
};

const getRedisConfig = () => ({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseRedisPort(process.env.REDIS_PORT),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
});

const createRedisClient = () => new Redis(getRedisConfig());

module.exports = {
  getRedisConfig,
  createRedisClient,
};
