const mongoose = require("mongoose");
const User = require("./models/User");
require("dotenv").config();

async function seedUsers() {
  try {
    // Connect to MongoDB with enhanced options
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");

    // Clear existing data
    await User.deleteMany({});
    console.log("Cleared existing users");

    // Insert test users first
    const testUsers = [
      {
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
        profilePicture: "https://randomuser.me/api/portraits/men/1.jpg",
        bio: "A random test user.",
        customMessage: "Hello, I am John!",
        status: "Hey there! I am using this app.",
        lastSeen: new Date(),
        isOnline: true,
        phoneNumber: "123-456-7890",
        dateOfBirth: new Date(1990, 1, 1),
        gender: "Male",
      },
      {
        name: "Jane Doe",
        email: "jane@example.com",
        password: "password456",
        profilePicture: "https://randomuser.me/api/portraits/women/1.jpg",
        bio: "Another random test user.",
        customMessage: "Hi, I'm Jane!",
        status: "Hey there! I am using this app.",
        lastSeen: new Date(),
        isOnline: false,
        phoneNumber: "098-765-4321",
        dateOfBirth: new Date(1992, 5, 15),
        gender: "Female",
      },
    ];

    const insertedUsers = await User.insertMany(testUsers);
    console.log(`Inserted ${insertedUsers.length} test users`);

    // Create main user with contacts in a single operation
    const mainUser = new User({
      name: "Main User",
      email: "mainuser@example.com",
      password: "password123",
      profilePicture: "https://randomuser.me/api/portraits/men/2.jpg",
      bio: "This is the main user.",
      customMessage: "Hello, I'm the main user!",
      status: "Hey there! I am using this app.",
      lastSeen: new Date(),
      isOnline: true,
      phoneNumber: "123-456-7890",
      dateOfBirth: new Date(1990, 1, 1),
      gender: "Male",
      contacts: insertedUsers.map((user) => user._id), // Set contacts here
    });

    await mainUser.save();
    console.log("Main user created with contacts");

    // Verify the main user
    const verifiedUser = await User.findById(mainUser._id).populate("contacts");
    console.log("Main user contacts:", verifiedUser.contacts.length);
  } catch (error) {
    console.error("\nSEEDING ERROR:", error.message);
    console.error("Error details:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

// Execute with proper error handling
seedUsers().catch((error) => {
  console.error("Unhandled seeding error:", error);
  process.exit(1);
});
