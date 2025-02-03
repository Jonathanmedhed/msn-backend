const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// WebSocket connection
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Listen for chat messages
  socket.on("sendMessage", async (data) => {
    const { chatId, senderId, content } = data;

    // Save the message
    const message = new Message({ chat: chatId, sender: senderId, content });
    await message.save();

    // Update the chat
    await Chat.findByIdAndUpdate(chatId, {
      $push: { messages: message._id },
      $set: { lastMessage: message._id, updatedAt: Date.now() },
    });

    // Broadcast the message to all participants in the chat
    io.emit("receiveMessage", message);
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
