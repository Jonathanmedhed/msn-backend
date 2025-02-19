const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  pictures: [{ type: String, default: [] }], // Array of pictures
  bio: { type: String, default: "" },
  customMessage: { type: String, default: "" },
  status: { type: String, default: "offline" },
  lastSeen: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  phoneNumber: { type: String, default: "" },
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ["Male", "Female", "Other"], default: "Other" },
  socialMedia: {
    facebook: { type: String, default: "" },
    twitter: { type: String, default: "" },
    instagram: { type: String, default: "" },
  },
  preferences: {
    theme: { type: String, default: "light" },
    notifications: { type: Boolean, default: true },
  },
  contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  // New blockedContacts field:
  blockedContacts: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

userSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

userSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("User", userSchema);
