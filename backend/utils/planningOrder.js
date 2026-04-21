const PLANNING_ORDER_INCREMENT = 1024;

const getPlanningOrderByIndex = (index) =>
  (Math.max(Number(index) || 0, 0) + 1) * PLANNING_ORDER_INCREMENT;

const buildRenumberOperations = (issues = []) =>
  issues.map((issue, index) => ({
    updateOne: {
      filter: {
        _id: issue._id,
      },
      update: {
        $set: {
          planningOrder: getPlanningOrderByIndex(index),
        },
      },
    },
  }));

const getNextPlanningOrder = async (IssueModel, query = {}) => {
  const lastIssue = await IssueModel.find(query)
    .sort({
      planningOrder: -1,
      createdAt: -1,
    })
    .select("planningOrder")
    .lean();

  if (!lastIssue?.planningOrder) {
    return PLANNING_ORDER_INCREMENT;
  }

  return Number(lastIssue.planningOrder) + PLANNING_ORDER_INCREMENT;
};

module.exports = {
  PLANNING_ORDER_INCREMENT,
  getPlanningOrderByIndex,
  buildRenumberOperations,
  getNextPlanningOrder,
};
