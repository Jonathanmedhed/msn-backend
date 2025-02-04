//Message.js
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true }, // Reference to the chat
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Sender of the message
  content: { type: String, required: true }, // Message content
  timestamp: { type: Date, default: Date.now }, // Timestamp of the message
});

// Create a virtual 'id' field that mirrors '_id'
messageSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

// Ensure the virtual field is included in JSON responses
messageSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Message", messageSchema);
