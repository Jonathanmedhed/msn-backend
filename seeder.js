const mongoose = require("mongoose");
const User = require("./models/User");
const Chat = require("./models/Chat");
require("dotenv").config();
const bcrypt = require("bcryptjs");

async function seedUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");

    await User.deleteMany({});
    console.log("Cleared existing users");

    // Insert test users and main user
    const testUsers = [
      {
        name: "John Doe",
        email: "john@example.com",
        password: bcrypt.hashSync("password123", 10),
        pictures: ["https://randomuser.me/api/portraits/men/1.jpg"],
        bio: "A random test user.",
        customMessage: "Hello, I am John!",
        status: "busy",
        lastSeen: new Date(),
        phoneNumber: "123-456-7890",
        dateOfBirth: new Date(1990, 1, 1),
        gender: "Male",
      },
      {
        name: "Jane Doe",
        email: "jane@example.com",
        password: bcrypt.hashSync("password456", 10),
        pictures: ["https://randomuser.me/api/portraits/women/1.jpg"],
        bio: "Another random test user.",
        customMessage: "Hi, I'm Jane!",
        status: "online",
        lastSeen: new Date(),
        phoneNumber: "098-765-4321",
        dateOfBirth: new Date(1992, 5, 15),
        gender: "Female",
      },
      // Main user added directly to testUsers array
      {
        name: "Main User",
        email: "mainuser@example.com",
        password: bcrypt.hashSync("password123", 10),
        pictures: ["https://randomuser.me/api/portraits/men/2.jpg"],
        bio: "This is the main user.",
        customMessage: "Hello, I'm the main user!",
        status: "offline",
        lastSeen: new Date(),
        phoneNumber: "123-456-7890",
        dateOfBirth: new Date(1990, 1, 1),
        gender: "Male",
      },
    ];

    const insertedUsers = await User.insertMany(testUsers);
    console.log(`Inserted ${insertedUsers.length} users`);

    // Get all user IDs
    const allUserIds = insertedUsers.map((user) => user._id);

    // Update each user to include all others as contacts
    for (const user of insertedUsers) {
      const otherUserIds = allUserIds.filter((id) => !id.equals(user._id));
      user.contacts = otherUserIds;
      await user.save();
    }

    console.log("All users updated with mutual contacts");

    // Verification
    for (const user of insertedUsers) {
      const populatedUser = await User.findById(user._id).populate("contacts");
      console.log(
        `User ${populatedUser.name} has ${populatedUser.contacts.length} contacts`
      );
    }
    // Create chats between all user pairs
    const pairs = [];
    for (let i = 0; i < insertedUsers.length; i++) {
      for (let j = i + 1; j < insertedUsers.length; j++) {
        pairs.push([insertedUsers[i]._id, insertedUsers[j]._id]);
      }
    }

    const chatPromises = pairs.map((pair) =>
      new Chat({
        participants: pair,
        messages: [],
        lastMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).save()
    );

    const insertedChats = await Promise.all(chatPromises);
    console.log(`Created ${insertedChats.length} chats between users`);

    // Link chats to users
    for (const user of insertedUsers) {
      const userChats = insertedChats.filter((chat) =>
        chat.participants.some((id) => id.equals(user._id))
      );
      user.chats = userChats.map((chat) => chat._id);
      await user.save();
    }
    console.log("Linked chats to all users");

    // Verification
    const populatedUsers = await User.find().populate({
      path: "chats",
      populate: { path: "participants", select: "name" },
    });

    console.log("\nChat verification:");
    populatedUsers.forEach((user) => {
      console.log(`\nUser ${user.name} has ${user.chats.length} chats:`);
      user.chats.forEach((chat) => {
        const names = chat.participants.map((p) => p.name).join(" & ");
        console.log(`- Chat with ${names}`);
      });
    });
  } catch (error) {
    console.error("\nSEEDING ERROR:", error.message);
    console.error("Error details:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

seedUsers().catch((error) => {
  console.error("Unhandled seeding error:", error);
  process.exit(1);
});
