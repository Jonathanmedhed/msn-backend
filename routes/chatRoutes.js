//routes/chatRoutes.js
const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const Chat = require("../models/Chat");

// Create a new chat (with participants)
router.post("/create", async (req, res) => {
  try {
    const { participantIds } = req.body;

    // Validate participantIds
    if (
      !participantIds ||
      !Array.isArray(participantIds) ||
      participantIds.length === 0
    ) {
      return res.status(400).json({
        error: "participantIds is required and must be a non-empty array",
      });
    }

    const chat = new Chat({ participants: participantIds });
    await chat.save();
    res.status(201).json({ message: "Chat created successfully", chat });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Send a message in a chat
router.post("/:chatId/send", async (req, res) => {
  try {
    const { chatId } = req.params;
    const { senderId, content } = req.body;

    // Validate required fields
    if (!senderId || !content) {
      return res
        .status(400)
        .json({ error: "senderId and content are required" });
    }

    // Create the message
    const message = new Message({ chat: chatId, sender: senderId, content });
    await message.save();

    // Update the chat with the new message
    await Chat.findByIdAndUpdate(chatId, {
      $push: { messages: message._id },
      $set: { lastMessage: message._id, updatedAt: Date.now() },
    });

    res
      .status(201)
      .json({ successMessage: "Message sent successfully", message });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all messages in a chat
router.get("/:chatId/messages", async (req, res) => {
  try {
    const { chatId } = req.params;
    const messages = await Message.find({ chat: chatId }).sort({
      timestamp: 1,
    });
    res.status(200).json(messages);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all chats for a user
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const chats = await Chat.find({ participants: userId })
      .populate("participants", "name email") // Populate participant details
      .populate("lastMessage"); // Populate last message details
    res.status(200).json(chats);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get messages between two users
router.get("/messages/:senderId/:recipientId", async (req, res) => {
  try {
    const { senderId, recipientId } = req.params;

    // Find the chat where both users are participants
    const chat = await Chat.findOne({
      participants: { $all: [senderId, recipientId] },
    });

    if (!chat) {
      return res.status(200).json([]); // No chat found, return empty array
    }

    // Fetch messages in the chat
    const messages = await Message.find({ chat: chat._id }).sort({
      timestamp: 1,
    });

    res.status(200).json(messages);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
