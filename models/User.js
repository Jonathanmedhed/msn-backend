//models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePicture: { type: String, default: "" }, // Path to profile picture
  pictures: [{ type: String, default: [] }], // Array of pictures
  bio: { type: String, default: "" },
  customMessage: { type: String, default: "" },
  status: { type: String, default: "Hey there! I am using this app." },
  lastSeen: { type: Date, default: Date.now },
  isOnline: { type: Boolean, default: false },
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
});

userSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

userSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("User", userSchema);
