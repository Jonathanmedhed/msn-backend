const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../server").app;
const Chat = require("../models/Chat");
const Message = require("../models/Message");
const User = require("../models/User");

describe("Chat Routes", () => {
  let chatId;
  let userId1;
  let userId2;
  let messageId;

  beforeAll(async () => {
    // Connect to the test database
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Clear all collections before running tests
    await Chat.deleteMany({});
    await Message.deleteMany({});
    await User.deleteMany({});

    // Create two test users with unique emails
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
  });

  afterAll(async () => {
    // Close the MongoDB connection
    await mongoose.connection.close();
  });

  // Test creating a new chat
  describe("POST /api/chats/create", () => {
    it("should create a new chat with participants", async () => {
      const res = await request(app)
        .post("/api/chats/create")
        .send({ participantIds: [userId1, userId2] });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty("message", "Chat created successfully");
      expect(res.body.chat).toHaveProperty("participants");
      expect(res.body.chat.participants.length).toEqual(2);

      chatId = res.body.chat._id; // Save the chat ID for later tests
    });

    it("should return an error if participantIds are missing", async () => {
      const res = await request(app).post("/api/chats/create").send({});

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  // Test sending a message in a chat
  describe("POST /api/chats/:chatId/send", () => {
    it("should send a message in a chat", async () => {
      const res = await request(app)
        .post(`/api/chats/${chatId}/send`)
        .send({ senderId: userId1, content: "Hello, User Two!" });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty(
        "successMessage",
        "Message sent successfully"
      ); // Updated key
      expect(res.body.message).toHaveProperty("content", "Hello, User Two!");

      messageId = res.body.message._id; // Save the message ID for later tests
    });

    it("should return an error if senderId or content is missing", async () => {
      const res = await request(app)
        .post(`/api/chats/${chatId}/send`)
        .send({ senderId: userId1 });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  // Test getting all messages in a chat
  describe("GET /api/chats/:chatId/messages", () => {
    it("should get all messages in a chat", async () => {
      const res = await request(app).get(`/api/chats/${chatId}/messages`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty("content", "Hello, User Two!");
    });

    it("should return an empty array if the chat has no messages", async () => {
      const newChat = new Chat({ participants: [userId1, userId2] });
      await newChat.save();

      const res = await request(app).get(`/api/chats/${newChat._id}/messages`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.length).toEqual(0);
    });
  });

  // Test getting all chats for a user
  describe("GET /api/chats/user/:userId", () => {
    it("should get all chats for a user", async () => {
      const res = await request(app).get(`/api/chats/user/${userId1}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty("participants");
      expect(res.body[0].participants.length).toEqual(2);
    });

    it("should return an empty array if the user has no chats", async () => {
      const newUser = new User({
        name: "User Three",
        email: `user3-${Date.now()}@example.com`, // Unique email
        password: "password123",
      });
      await newUser.save();

      const res = await request(app).get(`/api/chats/user/${newUser._id}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.length).toEqual(0);
    });
  });

  // Test getting messages between two users
  describe("GET /api/chats/messages/:senderId/:recipientId", () => {
    it("should get messages between two users", async () => {
      const res = await request(app).get(
        `/api/chats/messages/${userId1}/${userId2}`
      );

      expect(res.statusCode).toEqual(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty("content", "Hello, User Two!");
    });

    it("should return an empty array if no messages exist between the users", async () => {
      const newUser = new User({
        name: "User Four",
        email: `user4-${Date.now()}@example.com`, // Unique email
        password: "password123",
      });
      await newUser.save();

      const res = await request(app).get(
        `/api/chats/messages/${userId1}/${newUser._id}`
      );

      expect(res.statusCode).toEqual(200);
      expect(res.body.length).toEqual(0);
    });
  });
});
