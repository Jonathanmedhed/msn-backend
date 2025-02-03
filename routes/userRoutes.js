// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const bcrypt = require("bcryptjs");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const User = require("../models/User");

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

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/profile-pictures/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// Upload profile picture
router.post(
  "/:userId/upload-profile-picture",
  upload.single("profilePicture"),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const profilePicture = req.file.path; // Path to the uploaded file

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { profilePicture, updatedAt: Date.now() },
        { new: true }
      );

      res.status(200).json({
        message: "Profile picture uploaded successfully",
        user: updatedUser,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Add a picture to the user's pictures array
router.post("/:userId/add-picture", async (req, res) => {
  try {
    const { userId } = req.params;
    const { pictureUrl } = req.body; // URL of the new picture

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $push: { pictures: pictureUrl }, updatedAt: Date.now() },
      { new: true }
    );

    res
      .status(200)
      .json({ message: "Picture added successfully", user: updatedUser });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

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

module.exports = router;
