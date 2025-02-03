const request = require("supertest"); // Import the supertest library for making HTTP requests in tests
const { app } = require("../server"); // Import the express app from the server.js file (with the change made above)
const mongoose = require("mongoose"); // Import mongoose to connect and disconnect from the DB

let userId1, userId2, chatId; // Placeholder for user IDs and chat ID used in the tests

beforeAll(async () => {
  // Connect to the test database before running tests
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Create mock users in the database before tests
  const user1 = await request(app).post("/api/user/register").send({
    name: "User One",
    email: "user1@example.com",
    password: "password123",
  });
  userId1 = user1.body.user.id;

  const user2 = await request(app).post("/api/user/register").send({
    name: "User Two",
    email: "user2@example.com",
    password: "password123",
  });
  userId2 = user2.body.user.id;
});

afterAll(async () => {
  // Disconnect from the test database after tests
  await mongoose.connection.dropDatabase(); // Optionally drop the database after the tests
  await mongoose.disconnect();
});

describe("Chat Routes", () => {
  it("should create a new chat", async () => {
    const response = await request(app)
      .post("/api/chats/create")
      .send({ participantIds: [userId1, userId2] });
    chatId = response.body.chat._id; // Store the created chat ID for further tests
    expect(response.status).toBe(201); // Assert that the status code is 201 (created)
    expect(response.body.message).toBe("Chat created successfully");
    expect(response.body.chat.participants).toHaveLength(2); // Check if the participants are set correctly
  });

  it("should send a message in the chat", async () => {
    const response = await request(app)
      .post(`/api/chats/${chatId}/send`)
      .send({ senderId: userId1, content: "Hello, User Two!" });

    console.log("Response body:", response.body); // Log the full response body

    expect(response.status).toBe(201);

    // Check if the content is in the response, under the correct path
    expect(response.body.message.content).toBe("Hello, User Two!");
    expect(response.body.message._id).toBeDefined();
  });

  it("should get all messages in a chat", async () => {
    const response = await request(app)
      .get(`/api/chats/${chatId}/messages`)
      .send();
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1); // Only one message should exist in the chat
  });

  it("should get all chats for a user", async () => {
    const response = await request(app)
      .get(`/api/chats/user/${userId1}`)
      .send();
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1); // There should be one chat with the two users
  });

  it("should get messages between two users", async () => {
    const response = await request(app)
      .get(`/api/chats/${chatId}/messages`)
      .send();

    console.log("Messages between users:", response.body); // Log to see the response

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1); // Ensure the correct number of messages
    expect(response.body[0].content).toBe("Hello, User Two!"); // Ensure the message is correct
  });
});
