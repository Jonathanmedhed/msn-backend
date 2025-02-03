const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true }, // Reference to the chat
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Sender of the message
  content: { type: String, required: true }, // Message content
  timestamp: { type: Date, default: Date.now }, // Timestamp of the message
});

module.exports = mongoose.model("Message", messageSchema);
