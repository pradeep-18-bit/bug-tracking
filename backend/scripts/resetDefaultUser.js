const dotenv = require("dotenv");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const { resetDefaultUser, DEFAULT_USER } = require("../utils/defaultUser");

dotenv.config();

const run = async () => {
  try {
    await connectDB();
    await resetDefaultUser();

    console.log("[seed] Default credentials:");
    console.log(`email: ${DEFAULT_USER.email}`);
    console.log(`password: ${DEFAULT_USER.password}`);
  } catch (error) {
    console.error(`[seed] Reset failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
