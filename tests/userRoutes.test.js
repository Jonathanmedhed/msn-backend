require("dotenv").config(); // Load environment variables from .env file
const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../server"); // Import the app from server.js
const User = require("../models/User");
const path = require("path");

describe("User Routes", () => {
  let userId;
  let token;

  beforeAll(async () => {
    console.log("Connecting to the database...");
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Database connected.");

    console.log("Clearing the User collection...");
    await User.deleteMany({});
    console.log("User collection cleared.");

    console.log("Registering a test user...");
    const res = await request(app).post("/api/users/register").send({
      name: "John Doe",
      email: "john.doe@example.com",
      password: "password123",
      phoneNumber: "1234567890",
      dateOfBirth: "1990-01-01",
      gender: "Male",
    });
    console.log("Test user registered:", res.body.user);

    userId = res.body.user.id; // Save the user ID for later tests

    console.log("Logging in to get a token...");
    const loginRes = await request(app).post("/api/users/login").send({
      email: "john.doe@example.com",
      password: "password123",
    });
    console.log("Login successful. Token received.");

    token = loginRes.body.token; // Save the token for later tests
  });

  afterAll(async () => {
    console.log("Closing the database connection...");
    await mongoose.connection.close();
    console.log("Database connection closed.");
  });

  // Test user registration
  describe("POST /api/users/register", () => {
    it("should register a new user", async () => {
      console.log("Testing user registration...");
      const res = await request(app).post("/api/users/register").send({
        name: "Jane Doe",
        email: "jane.doe@example.com",
        password: "password123",
        phoneNumber: "1234567890",
        dateOfBirth: "1990-01-01",
        gender: "Female",
      });

      console.log("Response received:", res.body);

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty(
        "message",
        "User registered successfully"
      );
      expect(res.body.user).toHaveProperty("id");
      expect(res.body.user).toHaveProperty("name", "Jane Doe");
      expect(res.body.user).toHaveProperty("email", "jane.doe@example.com");

      console.log("User registration test passed.");
    });

    it("should return an error if the email is already in use", async () => {
      console.log("Testing duplicate email registration...");
      const res = await request(app).post("/api/users/register").send({
        name: "John Doe",
        email: "john.doe@example.com",
        password: "password123",
        phoneNumber: "1234567890",
        dateOfBirth: "1990-01-01",
        gender: "Male",
      });

      console.log("Response received:", res.body);

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty("error", "Email already in use");

      console.log("Duplicate email registration test passed.");
    });
  });

  // Test user login
  describe("POST /api/users/login", () => {
    it("should log in a user and return a token", async () => {
      console.log("Testing user login...");
      const res = await request(app).post("/api/users/login").send({
        email: "john.doe@example.com",
        password: "password123",
      });

      console.log("Response received:", res.body);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty("message", "Login successful");
      expect(res.body).toHaveProperty("token");
      expect(res.body.user).toHaveProperty("id", userId);
      expect(res.body.user).toHaveProperty("name", "John Doe");
      expect(res.body.user).toHaveProperty("email", "john.doe@example.com");

      console.log("User login test passed.");
    });

    it("should return an error for invalid credentials", async () => {
      console.log("Testing invalid login credentials...");
      const res = await request(app).post("/api/users/login").send({
        email: "john.doe@example.com",
        password: "wrongpassword",
      });

      console.log("Response received:", res.body);

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty("error", "Invalid credentials");

      console.log("Invalid login credentials test passed.");
    });
  });

  // Test user profile update
  describe("PUT /api/users/:userId/update", () => {
    it("should update the user profile", async () => {
      console.log("Testing user profile update...");
      const res = await request(app)
        .put(`/api/users/${userId}/update`)
        .set("Authorization", token)
        .send({
          name: "John Updated",
          bio: "This is my updated bio",
          status: "I am busy",
        });

      console.log("Response received:", res.body);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty(
        "message",
        "Profile updated successfully"
      );
      expect(res.body.user).toHaveProperty("name", "John Updated");
      expect(res.body.user).toHaveProperty("bio", "This is my updated bio");
      expect(res.body.user).toHaveProperty("status", "I am busy");

      console.log("User profile update test passed.");
    });

    it("should return an error if the user is not found", async () => {
      console.log("Testing profile update for a non-existent user...");
      const fakeUserId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/users/${fakeUserId}/update`)
        .set("Authorization", token)
        .send({
          name: "John Updated",
        });

      console.log("Response received:", res.body);

      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty("error", "User not found");

      console.log("Profile update for non-existent user test passed.");
    });
  });

  // Test profile picture upload
  describe("POST /api/users/:userId/upload-profile-picture", () => {
    it("should upload a profile picture", async () => {
      console.log("Testing profile picture upload...");
      const res = await request(app)
        .post(`/api/users/${userId}/upload-profile-picture`)
        .set("Authorization", token)
        .attach(
          "profilePicture",
          path.resolve(__dirname, "../uploads/pic1.jpg")
        );

      console.log("Response received:", res.body);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty(
        "message",
        "Profile picture uploaded successfully"
      );
      expect(res.body.user).toHaveProperty("profilePicture");

      console.log("Profile picture upload test passed.");
    });

    it("should return an error if no file is uploaded", async () => {
      console.log("Testing profile picture upload with no file...");
      const res = await request(app)
        .post(`/api/users/${userId}/upload-profile-picture`)
        .set("Authorization", token);

      console.log("Response received:", res.body);

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty("error", "No file uploaded");

      console.log("Profile picture upload with no file test passed.");
    });
  });

  // Test multiple pictures upload
  describe("POST /api/users/:userId/upload-pictures", () => {
    it("should upload multiple pictures", async () => {
      console.log("Testing multiple pictures upload...");
      const res = await request(app)
        .post(`/api/users/${userId}/upload-pictures`)
        .set("Authorization", token)
        .attach("pictures", path.resolve(__dirname, "../uploads/pic1.jpg"))
        .attach("pictures", path.resolve(__dirname, "../uploads/pic2.jpg"));

      console.log("Response received:", res.body);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty(
        "message",
        "Pictures uploaded successfully"
      );
      expect(res.body.user.pictures.length).toBeGreaterThanOrEqual(2);

      console.log("Multiple pictures upload test passed.");
    });
  });

  // Test user deletion
  describe("DELETE /api/users/:userId/delete", () => {
    it("should delete the user", async () => {
      console.log("Testing user deletion...");
      const res = await request(app)
        .delete(`/api/users/${userId}/delete`)
        .set("Authorization", token);

      console.log("Response received:", res.body);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty("message", "User deleted successfully");
      expect(res.body).toHaveProperty("userId", userId);

      console.log("User deletion test passed.");
    });

    it("should return an error if the user is not found", async () => {
      console.log("Testing deletion of a non-existent user...");
      const fakeUserId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/users/${fakeUserId}/delete`)
        .set("Authorization", token);

      console.log("Response received:", res.body);

      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty("error", "User not found");

      console.log("Deletion of non-existent user test passed.");
    });
  });
});
