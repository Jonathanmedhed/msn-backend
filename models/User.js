const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true }, // User's full name
  email: { type: String, required: true, unique: true }, // Unique email address
  password: { type: String, required: true }, // Hashed password
  profilePicture: { type: String, default: "" }, // Main profile picture
  pictures: [{ type: String, default: [] }], // Additional pictures
  bio: { type: String, default: "" }, // Short bio/description
  customMessage: { type: String, default: "" }, // Custom message like in Microsoft Messenger
  status: { type: String, default: "Hey there! I am using this app." }, // Custom status message
  lastSeen: { type: Date, default: Date.now }, // Timestamp of the last time the user was active
  isOnline: { type: Boolean, default: false }, // Whether the user is currently online
  createdAt: { type: Date, default: Date.now }, // Timestamp of user creation
  updatedAt: { type: Date, default: Date.now }, // Timestamp of last profile update
  phoneNumber: { type: String, default: "" }, // User's phone number
  dateOfBirth: { type: Date }, // User's date of birth
  gender: { type: String, enum: ["Male", "Female", "Other"], default: "Other" }, // User's gender
  socialMedia: {
    facebook: { type: String, default: "" },
    twitter: { type: String, default: "" },
    instagram: { type: String, default: "" },
  },
  preferences: {
    theme: { type: String, default: "light" }, // Light or dark theme
    notifications: { type: Boolean, default: true }, // Enable/disable notifications
  },
});

module.exports = mongoose.model("User", userSchema);
