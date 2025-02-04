require("dotenv").config(); // Load environment variables from .env file
const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../server"); // Import the app from server.js
const Chat = require("../models/Chat");
const Message = require("../models/Message");
const User = require("../models/User");

describe("Chat Routes", () => {
  let chatId;
  let userId1;
  let userId2;
  let messageId;

  beforeAll(async () => {
    console.log("Connecting to the database...");
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Database connected.");

    console.log("Clearing the Chat, Message, and User collections...");
    await Chat.deleteMany({});
    await Message.deleteMany({});
    await User.deleteMany({});
    console.log("Collections cleared.");

    console.log("Creating two test users...");
    const user1 = new User({
      name: "User One",
      email: `user1-${Date.now()}@example.com`, // Unique email
      password: "password123",
    });
    const user2 = new User({
      name: "User Two",
      email: `user2-${Date.now()}@example.com`, // Unique email
      password: "password123",
    });
    await user1.save();
    await user2.save();
    userId1 = user1._id;
    userId2 = user2._id;
    console.log("Test users created:", userId1, userId2);
  });

  afterAll(async () => {
    console.log("Closing the database connection...");
    await mongoose.connection.close();
    console.log("Database connection closed.");
  });

  // Test creating a new chat
  describe("POST /api/chats/create", () => {
    it("should create a new chat with participants", async () => {
      console.log("Testing chat creation...");
      const res = await request(app)
        .post("/api/chats/create")
        .send({ participantIds: [userId1, userId2] });

      console.log("Response received:", res.body);

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty("message", "Chat created successfully");
      expect(res.body.chat).toHaveProperty("participants");
      expect(res.body.chat.participants.length).toEqual(2);

      chatId = res.body.chat._id; // Save the chat ID for later tests
      console.log("Chat creation test passed.");
    });

    it("should return an error if participantIds are missing", async () => {
      console.log("Testing chat creation with missing participantIds...");
      const res = await request(app).post("/api/chats/create").send({});

      console.log("Response received:", res.body);

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty("error");

      console.log("Chat creation with missing participantIds test passed.");
    });
  });

  // Test sending a message in a chat
  describe("POST /api/chats/:chatId/send", () => {
    it("should send a message in a chat", async () => {
      console.log("Testing message sending...");
      const res = await request(app)
        .post(`/api/chats/${chatId}/send`)
        .send({ senderId: userId1, content: "Hello, User Two!" });

      console.log("Response received:", res.body);

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty(
        "successMessage",
        "Message sent successfully"
      );
      expect(res.body.message).toHaveProperty("content", "Hello, User Two!");

      messageId = res.body.message._id; // Save the message ID for later tests
      console.log("Message sending test passed.");
    });

    it("should return an error if senderId or content is missing", async () => {
      console.log(
        "Testing message sending with missing senderId or content..."
      );
      const res = await request(app)
        .post(`/api/chats/${chatId}/send`)
        .send({ senderId: userId1 });

      console.log("Response received:", res.body);

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty("error");

      console.log(
        "Message sending with missing senderId or content test passed."
      );
    });
  });

  // Test getting all messages in a chat
  describe("GET /api/chats/:chatId/messages", () => {
    it("should get all messages in a chat", async () => {
      console.log("Testing fetching all messages in a chat...");
      const res = await request(app).get(`/api/chats/${chatId}/messages`);

      console.log("Response received:", res.body);

      expect(res.statusCode).toEqual(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty("content", "Hello, User Two!");

      console.log("Fetching all messages in a chat test passed.");
    });

    it("should return an empty array if the chat has no messages", async () => {
      console.log("Testing fetching messages from a chat with no messages...");
      const newChat = new Chat({ participants: [userId1, userId2] });
      await newChat.save();

      const res = await request(app).get(`/api/chats/${newChat._id}/messages`);

      console.log("Response received:", res.body);

      expect(res.statusCode).toEqual(200);
      expect(res.body.length).toEqual(0);

      console.log(
        "Fetching messages from a chat with no messages test passed."
      );
    });
  });

  // Test getting all chats for a user
  describe("GET /api/chats/user/:userId", () => {
    it("should get all chats for a user", async () => {
      console.log("Testing fetching all chats for a user...");
      const res = await request(app).get(`/api/chats/user/${userId1}`);

      console.log("Response received:", res.body);

      expect(res.statusCode).toEqual(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty("participants");
      expect(res.body[0].participants.length).toEqual(2);

      console.log("Fetching all chats for a user test passed.");
    });

    it("should return an empty array if the user has no chats", async () => {
      console.log("Testing fetching chats for a user with no chats...");
      const newUser = new User({
        name: "User Three",
        email: `user3-${Date.now()}@example.com`, // Unique email
        password: "password123",
      });
      await newUser.save();

      const res = await request(app).get(`/api/chats/user/${newUser._id}`);

      console.log("Response received:", res.body);

      expect(res.statusCode).toEqual(200);
      expect(res.body.length).toEqual(0);

      console.log("Fetching chats for a user with no chats test passed.");
    });
  });

  // Test getting messages between two users
  describe("GET /api/chats/messages/:senderId/:recipientId", () => {
    it("should get messages between two users", async () => {
      console.log("Testing fetching messages between two users...");
      const res = await request(app).get(
        `/api/chats/messages/${userId1}/${userId2}`
      );

      console.log("Response received:", res.body);

      expect(res.statusCode).toEqual(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty("content", "Hello, User Two!");

      console.log("Fetching messages between two users test passed.");
    });

    it("should return an empty array if no messages exist between the users", async () => {
      console.log(
        "Testing fetching messages between users with no messages..."
      );
      const newUser = new User({
        name: "User Four",
        email: `user4-${Date.now()}@example.com`, // Unique email
        password: "password123",
      });
      await newUser.save();

      const res = await request(app).get(
        `/api/chats/messages/${userId1}/${newUser._id}`
      );

      console.log("Response received:", res.body);

      expect(res.statusCode).toEqual(200);
      expect(res.body.length).toEqual(0);

      console.log(
        "Fetching messages between users with no messages test passed."
      );
    });
  });
});
