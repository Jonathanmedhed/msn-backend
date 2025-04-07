const http = require("http");
const socketIo = require("socket.io");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

// Import models
const Message = require("./models/Message");
const Chat = require("./models/Chat");

const app = express();
const server = http.createServer(app);

// Middleware setup
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  const originalSend = res.send;
  res.send = function (body) {
    console.log(`Response for ${req.method} ${req.url}:`, body);
    originalSend.call(this, body);
  };
  next();
});

app.use(
  cors({
    origin: "https://msn-frontend-mu.vercel.app/",
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: "Content-Type,Authorization",
  })
);

app.use(express.json());

// Socket.IO Configuration
const io = socketIo(server, {
  cors: {
    origin: "https://msn-frontend-mu.vercel.app/",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io); // Add this line to make io available in routes

// Socket.IO Connection Handler
io.on("connection", (socket) => {
  //console.log("New client connected:", socket.id);

  socket.on("joinChat", async ({ chatId }) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(chatId)) {
        throw new Error("Invalid chat ID");
      }

      socket.join(chatId);
      //console.log(`User joined chat ${chatId}`);

      const messages = await Message.find({ chat: chatId })
        .sort({ createdAt: 1 })
        .populate("sender", "name profilePicture");

      socket.emit("chatHistory", messages);
    } catch (error) {
      console.error("Join chat error:", error.message);
      socket.emit("error", { message: error.message });
    }
  });

  socket.on("sendMessage", async (messageData) => {
    try {
      const { chatId, senderId, content } = messageData;

      // Add deduplication check (e.g., using a unique message hash)
      const existingMessage = await Message.findOne({
        chat: chatId,
        sender: senderId,
        content: content,
        createdAt: { $gt: new Date(Date.now() - 5000) }, // 5-second window
      });

      if (existingMessage) {
        return; // Skip duplicate
      }

      const message = new Message({
        chat: chatId,
        sender: senderId,
        content: content.trim(),
        status: "sent",
      });

      await message.save();

      await Chat.findByIdAndUpdate(chatId, {
        lastMessage: message._id,
        updatedAt: Date.now(),
      });

      const populatedMessage = await Message.findById(message._id).populate(
        "sender",
        "name profilePicture"
      );

      io.to(chatId).emit("newMessage", populatedMessage);
    } catch (error) {
      console.error("Message error:", error.message);
      socket.emit("error", { message: error.message });
    }
  });

  socket.on("updateMessageStatus", async ({ messageId, status }) => {
    try {
      const updatedMessage = await Message.findByIdAndUpdate(
        messageId,
        { status },
        { new: true }
      ).populate("sender", "name profilePicture");

      io.to(updatedMessage.chat.toString()).emit(
        "messageStatus",
        updatedMessage
      );
    } catch (error) {
      console.error("Status update error:", error.message);
    }
  });

  socket.on("updateStatus", async ({ userId, newStatus }) => {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { status: newStatus },
        { new: true }
      );

      // Broadcast to all connected clients
      io.emit("userStatusChange", {
        userId: user._id,
        status: user.status,
      });
    } catch (error) {
      console.error("Status update error:", error);
    }
  });

  socket.on("joinUser", (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their presence channel`);
  });

  socket.on("disconnect", () => {
    //console.log("Client disconnected:", socket.id);
  });
});

// Routes
const chatRoutes = require("./routes/chatRoutes");
const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
app.use("/api/chats", chatRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Server Start
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = { app, server };
