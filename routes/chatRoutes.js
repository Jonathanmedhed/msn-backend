const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const Chat = require("../models/Chat");

// Send a message
router.post("/send", async (req, res) => {
  try {
    const { senderId, recipientId, content } = req.body;
    const message = new Message({
      sender: senderId,
      recipient: recipientId,
      content,
    });
    await message.save();
    res.status(201).json({ message: "Message sent successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get messages between two users
router.get("/messages/:senderId/:recipientId", async (req, res) => {
  try {
    const { senderId, recipientId } = req.params;
    const messages = await Message.find({
      $or: [
        { sender: senderId, recipient: recipientId },
        { sender: recipientId, recipient: senderId },
      ],
    }).sort({ timestamp: 1 });
    res.status(200).json(messages);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create a new chat
router.post("/create", async (req, res) => {
  try {
    const { participantIds } = req.body; // Array of user IDs participating in the chat
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

    // Create the message
    const message = new Message({ chat: chatId, sender: senderId, content });
    await message.save();

    // Update the chat with the new message
    await Chat.findByIdAndUpdate(chatId, {
      $push: { messages: message._id }, // Add the message to the chat
      $set: { lastMessage: message._id, updatedAt: Date.now() }, // Update last message and timestamp
    });

    res.status(201).json({ message: "Message sent successfully", message });
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

module.exports = router;
