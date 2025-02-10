// Socket.IO Connection Handler
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("joinChat", async ({ chatId }) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(chatId)) {
        throw new Error("Invalid chat ID");
      }

      socket.join(chatId);
      console.log(`User joined chat ${chatId}`);

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

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});
