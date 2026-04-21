const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, ".env"),
});

const cors = require("cors");
const express = require("express");
const backlogRoutes = require("./routes/backlogRoutes");
const connectDB = require("./config/db");
const epicRoutes = require("./routes/epicRoutes");
const { errorHandler, notFound } = require("./middleware/errorMiddleware");
const authRoutes = require("./routes/authRoutes");
const commentRoutes = require("./routes/commentRoutes");
const issueRoutes = require("./routes/issueRoutes");
const projectRoutes = require("./routes/projectRoutes");
const reportRoutes = require("./routes/reportRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const sprintRoutes = require("./routes/sprintRoutes");
const teamRoutes = require("./routes/teamRoutes");
const testRoutes = require("./routes/testRoutes");
const userRoutes = require("./routes/userRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");
const { ensureDefaultUser } = require("./utils/defaultUser");
const syncProjectEpics = require("./utils/syncProjectEpics");
const syncIssueStatuses = require("./utils/syncIssueStatuses");
const syncWorkspaceScopes = require("./utils/syncWorkspaceScopes");

const app = express();
const PORT = process.env.PORT || 5000;

app.disable("x-powered-by");

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.resolve(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Jira Clone API is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/backlog", backlogRoutes);
app.use("/api/epics", epicRoutes);
app.use("/api/sprints", sprintRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/", testRoutes);

app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
  await connectDB();
  await ensureDefaultUser();
  await syncIssueStatuses();
  await syncWorkspaceScopes();
  await syncProjectEpics();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
