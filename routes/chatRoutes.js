const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Message = require("../models/Message");
const Chat = require("../models/Chat");
const User = require("../models/User");

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
    // Expect attachments as an array.
    const { senderId, content, attachments } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(chatId) ||
      !mongoose.Types.ObjectId.isValid(senderId)
    ) {
      return res.status(400).json({ error: "Invalid chat or sender ID" });
    }

    const sender = await User.findById(senderId);
    if (!sender) {
      return res.status(404).json({ error: "Sender not found" });
    }

    // If content is empty and attachments exist, provide a default fallback.
    const messageContent =
      (content && content.trim().length > 0) ||
      (attachments && attachments.length > 0)
        ? content
        : " ";

    // Create the new message, including attachments.
    const userMessage = new Message({
      chat: chatId,
      sender: senderId,
      content: messageContent,
      attachments: attachments || [],
      status: "sent",
    });
    await userMessage.save();
    await userMessage.populate("sender", "_id name avatar");

    // Retrieve the full updated chat (with populated messages)
    const fullUpdatedChat = await Chat.findById(chatId)
      .populate({
        path: "messages",
        populate: { path: "sender", select: "_id name avatar" },
      })
      .lean();

    res.status(201).json({
      chat: fullUpdatedChat,
      messages: [userMessage],
      message: userMessage,
    });

    // Update chat's last message to the user's message
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: userMessage._id,
      updatedAt: Date.now(),
    });

    // Emit a socket event for real-time updates
    const io = req.app.get("io");
    if (io) {
      io.to(chatId).emit("newMessage", userMessage);
    } else {
      console.error("Socket.io instance not found.");
    }
  } catch (error) {
    console.error("Error sending message:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
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
        select: "content createdAt, attachments",
      })
      .sort({ updatedAt: -1 });

    res.status(200).json(chats);
  } catch (error) {
    console.error("Error in GET /chats/user/:userId:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route to update a message's status (e.g., to "read")
router.patch("/:messageId/status", async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status } = req.body;

    // Optionally validate the status value
    const validStatuses = ["pending", "sent", "delivered", "read", "failed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const updatedMessage = await Message.findByIdAndUpdate(
      messageId,
      { status },
      { new: true }
    ).populate("sender", "name profilePicture");

    res.status(200).json({ message: updatedMessage });

    // Emit an event so that all clients in the chat room get the updated message status
    const io = req.app.get("io");
    if (io) {
      io.to(updatedMessage.chat.toString()).emit(
        "messageStatus",
        updatedMessage
      );
    }
  } catch (error) {
    console.error("Error updating message status:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
