const mongoose = require("mongoose");

// Define a sub-schema for each attachment.
const attachmentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["image", "file"],
      required: true,
    },
    url: { type: String, required: true },
    name: { type: String }, // Optional file name
  },
  { _id: false } // Prevent automatic _id for subdocuments
);

const messageSchema = new mongoose.Schema({
  chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String },
  // Change from a single attachment to an array of attachments
  attachments: { type: [attachmentSchema], default: [] },
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
