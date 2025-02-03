// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const multer = require("multer");
const path = require("path");

// Update user profile
router.put("/:userId/update", async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, profilePicture, pictures, bio, customMessage, status } =
      req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        name,
        profilePicture,
        pictures,
        bio,
        customMessage,
        status,
        updatedAt: Date.now(),
      },
      { new: true } // Return the updated user
    );

    res
      .status(200)
      .json({ message: "Profile updated successfully", user: updatedUser });
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

// Upload multiple pictures
router.post(
  "/:userId/upload-pictures",
  upload.array("pictures", 10),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const pictureUrls = req.files.map((file) => file.path); // Array of file paths

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $push: { pictures: { $each: pictureUrls } }, updatedAt: Date.now() }, // Add all pictures to the array
        { new: true }
      );

      res
        .status(200)
        .json({ message: "Pictures uploaded successfully", user: updatedUser });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload images to Cloudinary
router.post(
  "/:userId/upload-pictures",
  upload.array("pictures", 10),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const pictureUrls = [];

      // Upload each file to Cloudinary
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(file.path);
        pictureUrls.push(result.secure_url); // Store the Cloudinary URL
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $push: { pictures: { $each: pictureUrls } }, updatedAt: Date.now() },
        { new: true }
      );

      res
        .status(200)
        .json({ message: "Pictures uploaded successfully", user: updatedUser });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

module.exports = router;
