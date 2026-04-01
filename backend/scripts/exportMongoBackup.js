const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { EJSON } = require("bson");

const envPath = path.join(__dirname, "..", ".env");
dotenv.config({ path: envPath });

const BACKUP_ROOT = path.join(
  __dirname,
  "..",
  "..",
  "deploy",
  "mongo",
  "backup",
  "bugtracker"
);
const DB_NAME = "bugtracker";

const ensureDirectory = (targetPath) => {
  fs.mkdirSync(targetPath, { recursive: true });
};

const cleanDirectory = (targetPath) => {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  fs.rmSync(targetPath, {
    recursive: true,
    force: true,
  });
};

const serializeIndex = (index) => {
  const {
    key,
    name,
    unique,
    sparse,
    expireAfterSeconds,
    partialFilterExpression,
    collation,
  } = index;

  const serializedIndex = {
    key,
    name,
  };

  if (unique) {
    serializedIndex.unique = true;
  }

  if (sparse) {
    serializedIndex.sparse = true;
  }

  if (typeof expireAfterSeconds === "number") {
    serializedIndex.expireAfterSeconds = expireAfterSeconds;
  }

  if (partialFilterExpression) {
    serializedIndex.partialFilterExpression = partialFilterExpression;
  }

  if (collation) {
    serializedIndex.collation = collation;
  }

  return serializedIndex;
};

const exportBackup = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI environment variable is required");
  }

  await mongoose.connect(mongoUri, {
    dbName: DB_NAME,
  });

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  cleanDirectory(BACKUP_ROOT);
  ensureDirectory(BACKUP_ROOT);

  const manifest = {
    database: DB_NAME,
    exportedAt: new Date().toISOString(),
    collections: [],
  };

  for (const collectionInfo of collections.sort((left, right) =>
    left.name.localeCompare(right.name)
  )) {
    const collection = db.collection(collectionInfo.name);
    const documents = await collection.find({}).toArray();
    const indexes = await collection.indexes();
    const fileName = `${collectionInfo.name}.json`;

    fs.writeFileSync(
      path.join(BACKUP_ROOT, fileName),
      EJSON.stringify(documents, null, 2),
      "utf8"
    );

    manifest.collections.push({
      name: collectionInfo.name,
      file: fileName,
      count: documents.length,
      indexes: indexes.map(serializeIndex),
    });
  }

  fs.writeFileSync(
    path.join(BACKUP_ROOT, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  await mongoose.disconnect();

  console.log(
    `[backup] Exported ${manifest.collections.length} collections to ${BACKUP_ROOT}`
  );
};

exportBackup().catch(async (error) => {
  console.error("[backup] Export failed:", error.message);

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  process.exit(1);
});
