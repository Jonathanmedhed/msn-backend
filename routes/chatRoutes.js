const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Message = require("../models/Message");
const Chat = require("../models/Chat");

// Create a new chat
router.post("/create", async (req, res) => {
  try {
    const { participantIds } = req.body;

    if (!participantIds || !Array.isArray(participantIds)) {
      return res.status(400).json({ error: "Invalid participant IDs" });
    }

    // Check for existing chat
    const existingChat = await Chat.findOne({
      participants: { $all: participantIds },
      $size: participantIds.length,
    });

    if (existingChat) {
      return res.status(200).json(existingChat);
    }

    const chat = new Chat({ participants: participantIds });
    await chat.save();

    res.status(201).json(chat);
  } catch (error) {
    console.error("Error creating chat:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Send a message
router.post("/:chatId/send", async (req, res) => {
  try {
    const { chatId } = req.params;
    const { senderId, content } = req.body;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ error: "Invalid chat ID" });
    }

    const message = new Message({
      chat: chatId,
      sender: senderId,
      content,
    });

    await message.save();

    // Update chat's last message and timestamp
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: message._id,
      updatedAt: Date.now(),
    });

    res.status(201).json(message);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get chat messages
router.get("/:chatId/messages", async (req, res) => {
  try {
    const { chatId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ error: "Invalid chat ID" });
    }

    const messages = await Message.find({ chat: chatId })
      .sort({ createdAt: 1 })
      .populate("sender", "name profilePicture");

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get user chats
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const chats = await Chat.find({ participants: userId })
      .populate("participants", "name profilePicture status")
      .populate("lastMessage")
      .sort({ updatedAt: -1 });

    res.status(200).json(chats);
  } catch (error) {
    console.error("Error fetching user chats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
