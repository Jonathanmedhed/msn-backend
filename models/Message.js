const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  status: {
    type: String,
    enum: ["pending", "sent", "delivered", "read", "failed"],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
});

messageSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

messageSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Message", messageSchema);
