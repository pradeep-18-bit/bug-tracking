const express = require("express");
const {
  createConversation,
  createMessage,
  getConversationById,
  getConversations,
  getMessages,
  searchUsers,
  uploadChatAttachment,
  uploadChatAttachmentMiddleware,
} = require("../controllers/chat.controller");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/conversations", protect, getConversations);
router.post("/conversations", protect, createConversation);
router.get("/conversation/:id", protect, getConversationById);
router.get("/messages/:conversationId", protect, getMessages);
router.post("/messages", protect, createMessage);
router.post("/attachments", protect, uploadChatAttachmentMiddleware, uploadChatAttachment);
router.get("/users/search", protect, searchUsers);

module.exports = router;
