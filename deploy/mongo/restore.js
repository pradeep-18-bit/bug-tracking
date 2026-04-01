const manifestPath = "/docker-entrypoint-initdb.d/backup/bugtracker/manifest.json";
const manifest = JSON.parse(cat(manifestPath));
const databaseName = manifest.database || "bugtracker";
const database = db.getSiblingDB(databaseName);

print(`[mongo-restore] Restoring ${manifest.collections.length} collections into ${databaseName}`);

manifest.collections.forEach((collectionConfig) => {
  const collectionName = collectionConfig.name;
  const filePath = `/docker-entrypoint-initdb.d/backup/${databaseName}/${collectionConfig.file}`;
  const rawContents = cat(filePath).trim();
  const documents = rawContents ? EJSON.parse(rawContents) : [];
  const collection = database.getCollection(collectionName);

  if (Array.isArray(documents) && documents.length) {
    collection.insertMany(documents, { ordered: false });
  }

  (collectionConfig.indexes || [])
    .filter((index) => index.name !== "_id_")
    .forEach((index) => {
      const { key, ...options } = index;
      collection.createIndex(key, options);
    });

  print(
    `[mongo-restore] ${collectionName}: restored ${Array.isArray(documents) ? documents.length : 0} documents`
  );
});
