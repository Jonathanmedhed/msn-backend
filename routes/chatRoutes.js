const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Message = require("../models/Message");
const Chat = require("../models/Chat");

// Create a new chat
router.post("/create", async (req, res) => {
  try {
    const { participantIds } = req.body;

    // Enhanced validation
    if (!Array.isArray(participantIds)) {
      return res.status(400).json({ error: "participantIds must be an array" });
    }

    if (participantIds.length !== 2) {
      return res
        .status(400)
        .json({ error: "Exactly 2 participant IDs required" });
    }

    if (participantIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ error: "Invalid participant ID format" });
    }

    // Check for existing chat
    const existingChat = await Chat.findOne({
      participants: {
        $all: participantIds,
        $size: 2,
      },
    });

    if (existingChat) {
      return res.status(200).json(existingChat);
    }

    // Create new chat
    const chat = new Chat({
      participants: participantIds,
      createdAt: Date.now(),
    });

    await chat.save();
    res.status(201).json(chat);
  } catch (error) {
    console.error("Chat creation error:", error);
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
    if (!mongoose.Types.ObjectId.isValid(senderId)) {
      return res.status(400).json({ error: "Invalid sender ID" });
    }

    const message = new Message({
      chat: chatId,
      sender: senderId,
      content,
      status: "sent",
    });

    await message.save();

    // Optionally populate the sender field
    await message.populate("sender", "_id name avatar");

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
    const messages = await Message.find({ chat: req.params.chatId })
      .sort({ createdAt: 1 })
      .populate({
        path: "sender",
        select: "name profilePicture",
      });

    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get user chats
router.get("/user/:userId", async (req, res) => {
  try {
    // Validate that req.params.userId is a valid ObjectId string
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const chats = await Chat.find({
      participants: { $in: [new mongoose.Types.ObjectId(req.params.userId)] },
    })
      .populate({
        path: "participants",
        select: "name profilePicture status",
      })
      .populate({
        path: "lastMessage",
        select: "content createdAt",
      })
      .sort({ updatedAt: -1 });

    res.status(200).json(chats);
  } catch (error) {
    console.error("Error in GET /chats/user/:userId:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
