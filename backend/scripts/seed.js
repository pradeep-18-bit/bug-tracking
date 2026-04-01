const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const connectDB = require("../config/db");
const User = require("../models/User");
const { normalizeWorkspaceId } = require("../utils/workspace");

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const seedAdminUser = async () => {
  try {
    await connectDB();

    const adminEmail = "admin@example.com";
    const existingAdmin = await User.findOne({
      email: adminEmail.toLowerCase(),
    });

    if (!existingAdmin) {
      await User.create({
        name: "Admin User",
        email: adminEmail,
        password: "admin123",
        role: "Admin",
        workspaceId: normalizeWorkspaceId(),
      });

      console.log("Admin user created");
      return;
    }

    console.log("Admin user already exists");
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
};

if (require.main === module) {
  seedAdminUser();
}

module.exports = seedAdminUser;
