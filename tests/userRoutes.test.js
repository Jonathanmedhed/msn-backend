//tests/userRoutes.test.js
require("dotenv").config(); // Load the existing .env file
const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../server").app;
const User = require("../models/User");
const path = require("path");

describe("User Routes", () => {
  let userId;
  let token;

  beforeAll(async () => {
    // Connect to the real database
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Clear the User collection before running tests
    await User.deleteMany({});
  });

  afterAll(async () => {
    // Close the MongoDB connection
    await mongoose.connection.close();
  });

  // Test user registration
  describe("POST /api/users/register", () => {
    it("should register a new user", async () => {
      const res = await request(app).post("/api/users/register").send({
        name: "John Doe",
        email: "john.doe@example.com",
        password: "password123",
        phoneNumber: "1234567890",
        dateOfBirth: "1990-01-01",
        gender: "Male",
      });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty(
        "message",
        "User registered successfully"
      );
      expect(res.body.user).toHaveProperty("id");
      expect(res.body.user).toHaveProperty("name", "John Doe");
      expect(res.body.user).toHaveProperty("email", "john.doe@example.com");

      userId = res.body.user.id; // Save the user ID for later tests
    });

    it("should return an error if the email is already in use", async () => {
      const res = await request(app).post("/api/users/register").send({
        name: "John Doe",
        email: "john.doe@example.com",
        password: "password123",
        phoneNumber: "1234567890",
        dateOfBirth: "1990-01-01",
        gender: "Male",
      });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty("error", "Email already in use");
    });
  });

  // Test user login
  describe("POST /api/users/login", () => {
    it("should log in a user and return a token", async () => {
      const res = await request(app).post("/api/users/login").send({
        email: "john.doe@example.com",
        password: "password123",
      });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty("message", "Login successful");
      expect(res.body).toHaveProperty("token");
      expect(res.body.user).toHaveProperty("id", userId);
      expect(res.body.user).toHaveProperty("name", "John Doe");
      expect(res.body.user).toHaveProperty("email", "john.doe@example.com");

      token = res.body.token; // Save the token for later tests
    });

    it("should return an error for invalid credentials", async () => {
      const res = await request(app).post("/api/users/login").send({
        email: "john.doe@example.com",
        password: "wrongpassword",
      });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty("error", "Invalid credentials");
    });
  });

  // Test user profile update
  describe("PUT /api/users/:userId/update", () => {
    it("should update the user profile", async () => {
      const res = await request(app)
        .put(`/api/users/${userId}/update`)
        .set("Authorization", token)
        .send({
          name: "John Updated",
          bio: "This is my updated bio",
          status: "I am busy",
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty(
        "message",
        "Profile updated successfully"
      );
      expect(res.body.user).toHaveProperty("name", "John Updated");
      expect(res.body.user).toHaveProperty("bio", "This is my updated bio");
      expect(res.body.user).toHaveProperty("status", "I am busy");
    });

    it("should return an error if the user is not found", async () => {
      const fakeUserId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/users/${fakeUserId}/update`)
        .set("Authorization", token)
        .send({
          name: "John Updated",
        });

      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty("error", "User not found");
    });
  });

  // Test profile picture upload
  describe("POST /api/users/:userId/upload-profile-picture", () => {
    it("should upload a profile picture", async () => {
      const res = await request(app)
        .post(`/api/users/${userId}/upload-profile-picture`)
        .set("Authorization", token)
        .attach(
          "profilePicture",
          path.resolve(__dirname, "../uploads/pic1.jpg")
        );

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty(
        "message",
        "Profile picture uploaded successfully"
      );
      expect(res.body.user).toHaveProperty("profilePicture");
    });

    it("should return an error if no file is uploaded", async () => {
      const res = await request(app)
        .post(`/api/users/${userId}/upload-profile-picture`)
        .set("Authorization", token);

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty("error", "No file uploaded");
    });
  });

  // Test multiple pictures upload
  describe("POST /api/users/:userId/upload-pictures", () => {
    it("should upload multiple pictures", async () => {
      const res = await request(app)
        .post(`/api/users/${userId}/upload-pictures`)
        .set("Authorization", token)
        .attach("pictures", path.resolve(__dirname, "../uploads/pic1.jpg"))
        .attach("pictures", path.resolve(__dirname, "../uploads/pic2.jpg"));

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty(
        "message",
        "Pictures uploaded successfully"
      );
      expect(res.body.user.pictures.length).toBeGreaterThanOrEqual(2);
    });
  });

  // Test user deletion
  describe("DELETE /api/users/:userId/delete", () => {
    it("should delete the user", async () => {
      const res = await request(app)
        .delete(`/api/users/${userId}/delete`)
        .set("Authorization", token);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty("message", "User deleted successfully");
      expect(res.body).toHaveProperty("userId", userId);
    });

    it("should return an error if the user is not found", async () => {
      const fakeUserId = new mongoose.Types.ObjectId(); // Generate a fake user ID

      const res = await request(app)
        .delete(`/api/users/${fakeUserId}/delete`)
        .set("Authorization", token);

      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty("error", "User not found");
    });
  });
});
