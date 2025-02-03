const http = require("http");
const socketIo = require("socket.io");
const CryptoJS = require("crypto-js");
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config(); // Load environment variables

// Import the routes
const chatRoutes = require("./routes/chatRoutes");
const userRoutes = require("./routes/userRoutes");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const cloudinary = require("cloudinary").v2;

// Encryption secret key (store this in your .env file)
const secretKey = process.env.ENCRYPTION_SECRET_KEY;

// Middleware
app.use(express.json());

// Routes
app.use("/api/chats", chatRoutes);
app.use("/api/user", userRoutes);

// Encryption and Decryption
const encryptMessage = (message) => {
  return CryptoJS.AES.encrypt(message, secretKey).toString();
};

const decryptMessage = (encryptedMessage) => {
  const bytes = CryptoJS.AES.decrypt(encryptedMessage, secretKey);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// WebSocket connection
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Listen for chat messages
  socket.on("sendMessage", async (data) => {
    const { chatId, senderId, content } = data;

    // Encrypt the message content
    const encryptedContent = encryptMessage(content);

    // Save the encrypted message
    const message = new Message({
      chat: chatId,
      sender: senderId,
      content: encryptedContent,
    });
    await message.save();

    // Update the chat
    await Chat.findByIdAndUpdate(chatId, {
      $push: { messages: message._id },
      $set: { lastMessage: message._id, updatedAt: Date.now() },
    });

    // Decrypt the message for broadcasting
    const decryptedMessage = {
      ...message.toObject(),
      content: decryptMessage(encryptedContent),
    };

    // Broadcast the decrypted message to all participants in the chat
    io.emit("receiveMessage", decryptedMessage);
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

// Serve static files from the "uploads" directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
