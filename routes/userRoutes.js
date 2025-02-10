// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const bcrypt = require("bcryptjs");
const path = require("path");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const User = require("../models/User");

// Login user (authenticate)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if the user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Compare the password with the hashed password stored in the database
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Generate JWT token (this token will be used for authentication)
    const token = jwt.sign(
      { userId: user._id }, // Payload (user id)
      process.env.JWT_SECRET, // Secret key (store this in an environment variable)
      { expiresIn: "1h" } // Token expiration time
    );

    // Send success response with the user info and token
    res.status(200).json({
      message: "Login successful",
      token, // Include the token in the response
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        status: user.status,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new user
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phoneNumber, dateOfBirth, gender } =
      req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already in use" });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create the new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      phoneNumber,
      dateOfBirth,
      gender,
    });

    // Save user to database
    await newUser.save();

    res.status(201).json({
      message: "User registered successfully",
      user: { id: newUser._id, name: newUser.name, email: newUser.email },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route to get the main user with their contacts
router.get("/main-user", async (req, res) => {
  try {
    // Find the main user
    const mainUser = await User.findOne({ email: "mainuser@example.com" })
      .populate("contacts", "name email profilePicture status bio") // Populating contacts data
      .exec();

    console.log(mainUser);
    if (!mainUser) {
      return res.status(404).json({ message: "Main user not found" });
    }

    res.status(200).json(mainUser);
  } catch (error) {
    console.error("Error fetching main user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Update user profile
router.put("/:userId/update", async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      name,
      profilePicture,
      pictures,
      bio,
      customMessage,
      status,
      phoneNumber,
      dateOfBirth,
      gender,
      socialMedia,
      preferences,
    } = req.body;

    // Find the user and update their fields
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        name,
        profilePicture,
        pictures,
        bio,
        customMessage,
        status,
        phoneNumber,
        dateOfBirth,
        gender,
        socialMedia,
        preferences,
        updatedAt: Date.now(), // Ensure the updatedAt field is updated
      },
      { new: true } // Return the updated user
    );

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get user profile
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("-password"); // Exclude password
    res.status(200).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Specify where files should be stored
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Give the file a unique name
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type, only images are allowed"), false);
  }
};

const upload = multer({ storage, fileFilter });

// Route to upload profile picture
router.post(
  "/:userId/upload-profile-picture",
  upload.single("profilePicture"),
  async (req, res) => {
    try {
      console.log("Received file:", req.file);

      if (!req.file) {
        console.log("No file uploaded");
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { userId } = req.params;
      const profilePicture = path.normalize(req.file.path);

      console.log("Updating user with profile picture:", profilePicture);

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { profilePicture, updatedAt: Date.now() },
        { new: true }
      );

      if (!updatedUser) {
        console.log("User not found");
        return res.status(404).json({ error: "User not found" });
      }

      console.log("User updated successfully:", updatedUser);

      res.status(200).json({
        message: "Profile picture uploaded successfully",
        user: updatedUser,
      });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Upload multiple pictures to Cloudinary
router.post(
  "/:userId/upload-pictures",
  upload.array("pictures", 10), // Allow up to 10 files
  async (req, res) => {
    try {
      const { userId } = req.params;
      const pictureUrls = [];

      // Upload each file to Cloudinary
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(file.path); // Upload to Cloudinary
        pictureUrls.push(result.secure_url); // Store the Cloudinary URL

        // Delete the local file after uploading to Cloudinary
        fs.unlinkSync(file.path);
      }

      // Update the user's pictures array
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $push: { pictures: { $each: pictureUrls } }, updatedAt: Date.now() },
        { new: true }
      );

      res.status(200).json({
        message: "Pictures uploaded successfully",
        user: updatedUser,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Delete a user
const jwt = require("jsonwebtoken");

// Middleware to authenticate JWT token
const authenticateJWT = (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) {
    return res.status(403).json({ error: "No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }
    req.user = user;
    next();
  });
};

// Apply authentication middleware to delete route
router.delete("/:userId/delete", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Only allow the user to delete their own account or an admin
    if (req.user.userId !== userId && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "You are not authorized to delete this account" });
    }

    // Delete the user
    const deletedUser = await User.findByIdAndDelete(userId);

    res.status(200).json({
      message: "User deleted successfully",
      userId: deletedUser._id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
