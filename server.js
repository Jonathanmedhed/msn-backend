const http = require("http");
const socketIo = require("socket.io");
const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware, routes, and other setup
app.use(express.json());

// Import routes
const chatRoutes = require("./routes/chatRoutes");
const userRoutes = require("./routes/userRoutes");

// Use routes
app.use("/api/chats", chatRoutes);
app.use("/api/users", userRoutes);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Export app and server for use in tests
module.exports = { app, server };

// Start the server only if this file is run directly (not required by another module)
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
