const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Route not found: ${req.originalUrl}`));
};

const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  let message = err.message || "Internal server error";

  if (err.name === "CastError") {
    message = "Invalid resource id";
  }

  if (err.name === "ValidationError") {
    message = Object.values(err.errors)
      .map((item) => item.message)
      .join(", ");
  }

  if (err.code === 11000) {
    message = "A record with that value already exists";
  }

  if (err.name === "MulterError" && err.code === "LIMIT_FILE_SIZE") {
    message = "CSV file is too large";
  }

  res.status(statusCode).json({
    message,
    code:
      typeof err.code === "string" && err.code !== "MulterError" && err.code !== "ValidationError"
        ? err.code
        : undefined,
    details: err.details || undefined,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
};

module.exports = {
  notFound,
  errorHandler,
};
