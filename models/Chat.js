//Chat.js
const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  participants: [
    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  ], // Users in the chat
  messages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }], // Messages in the chat
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" }, // Reference to the last message
  createdAt: { type: Date, default: Date.now }, // Timestamp of chat creation
  updatedAt: { type: Date, default: Date.now }, // Timestamp of last activity
});

// Create a virtual 'id' field that mirrors '_id'
chatSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

// Ensure the virtual field is included in JSON responses
chatSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Chat", chatSchema);
