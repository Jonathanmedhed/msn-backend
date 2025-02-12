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
    const { senderId, content } = req.body;
    const MAIN_USER_NAME = "Main User";

    if (
      !mongoose.Types.ObjectId.isValid(chatId) ||
      !mongoose.Types.ObjectId.isValid(senderId)
    ) {
      return res.status(400).json({ error: "Invalid chat or sender ID" });
    }

    const sender = await User.findById(senderId);
    if (!sender) {
      console.log("Sender not found.");
      return res.status(404).json({ error: "Sender not found" });
    }
    console.log("Sender found.");

    // Save the user's message
    const userMessage = new Message({
      chat: chatId,
      sender: senderId,
      content,
      status: "sent",
    });
    await userMessage.save();
    await userMessage.populate("sender", "_id name avatar");

    console.log("Message sent:", userMessage);

    let autoReply = null; // Store auto-reply message if applicable
    let updatedMessages = [userMessage]; // Start with user message

    if (sender.name === MAIN_USER_NAME) {
      const chat = await Chat.findById(chatId).lean();
      if (chat) {
        console.log("Chat found.");

        const receiverId = chat.participants.find(
          (id) => id.toString() !== senderId
        );

        if (receiverId) {
          const receiver = await User.findById(receiverId);
          if (receiver) {
            console.log("Receiver found.");
            console.log("Auto-reply from:", receiver.name);

            autoReply = new Message({
              chat: chatId,
              sender: receiverId,
              content: "Thank you for your message! I'll respond shortly.",
              status: "sent",
              createdAt: new Date(Date.now() - 5000), // Auto-reply is 5 seconds older
            });

            await autoReply.save();
            await autoReply.populate("sender", "_id name avatar");

            console.log("Auto-reply sent:", autoReply);
            updatedMessages.push(autoReply);
          }
        }
      }
    }

    // Send the full chat with updated messages before updating lastMessage in the database
    const fullUpdatedChat = await Chat.findById(chatId)
      .populate({
        path: "messages",
        populate: { path: "sender", select: "_id name avatar" },
      })
      .lean();

    // Respond to the client with the updated chat
    res.status(201).json({
      chat: fullUpdatedChat,
      messages: updatedMessages,
    });

    // Update chat last message
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: autoReply ? autoReply._id : userMessage._id,
      updatedAt: Date.now(),
    });

    // Emit socket event for real-time updates
    const io = req.app.get("io");
    if (io) {
      io.to(chatId).emit("newMessage", updatedMessages);
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
