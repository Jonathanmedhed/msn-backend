// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const bcrypt = require("bcryptjs");
const path = require("path");
const User = require("../models/User");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const jwt = require("jsonwebtoken");
const Chat = require("../models/Chat");

// Middleware to authenticate JWT token
const authenticateJWT = (req, res, next) => {
  let token = req.header("Authorization");

  if (!token) {
    return res.status(403).json({ error: "No token provided" });
  }

  // Remove 'Bearer ' prefix if present
  if (token.startsWith("Bearer ")) {
    token = token.slice(7, token.length).trim();
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }
    req.user = user;
    next();
  });
};

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Compare the provided password with the stored hashed password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Generate token with user's id
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);

    // Respond with token and user data
    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/me", authenticateJWT, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .populate("contacts", "name email pictures customMessage status bio")
      .populate("friendRequestsSent", "name email")
      .populate(
        "friendRequestsReceived",
        "name email pictures customMessage status bio"
      )
      .populate({
        path: "chats",
        populate: {
          path: "participants",
          select: "name profilePicture status",
        },
      })
      .exec();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/logout", authenticateJWT, (req, res) => {
  // For a JWT-based system, logout is usually handled on the client.
  // If you use refresh tokens or token blacklisting, implement that logic here.
  res.status(200).json({ message: "Logged out successfully" });
});

// Create a new user
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body; // only use these fields

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

// Route to get the main user with their contacts (Testing Only)
router.get("/main-user", async (req, res) => {
  try {
    // Find the main user
    const mainUser = await User.findOne({ email: "mainuser@example.com" })
      .populate("contacts", "name email pictures customMessage status bio") // Populating contacts data
      .exec();

    if (!mainUser) {
      return res.status(404).json({ message: "Main user not found" });
    }

    res.status(200).json(mainUser);
  } catch (error) {
    console.error("Error fetching main user:", error);
    res.status(500).json({ message: "Internal server error" });
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

const fileUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Allow common file types. You can add or remove types as needed.
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type, allowed types are: JPEG, PNG, PDF, DOC, DOCX"
        ),
        false
      );
    }
  },
});

const upload = multer({ storage, fileFilter });

/* ------------------------------
   Route: Upload Profile Picture
   ------------------------------ */
// Route: Upload Profile Picture (using Cloudinary upload_stream)
router.post(
  "/:userId/upload-profile-picture",
  upload.single("profilePicture"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Helper function to stream upload the file to Cloudinary
      const streamUpload = (filePath) => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "profile_pictures",
              transformation: [{ width: 500, height: 500, crop: "limit" }],
            },
            (error, result) => {
              if (result) {
                resolve(result);
              } else {
                reject(error);
              }
            }
          );
          fs.createReadStream(filePath).pipe(stream);
        });
      };

      // Upload the file using the streamUpload helper
      const result = await streamUpload(req.file.path);

      // Remove the temporary local file
      fs.unlinkSync(req.file.path);

      const profilePicture = result.secure_url;
      const { userId } = req.params;

      // Update the user's profile picture field with the Cloudinary URL
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { profilePicture, updatedAt: Date.now() },
        { new: true }
      );

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.status(200).json({
        message: "Profile picture uploaded successfully",
        user: updatedUser,
      });
    } catch (err) {
      console.error("Profile picture upload error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

/* -----------------------------
     Route: Upload Multiple Pictures
     ----------------------------- */
router.post(
  "/:userId/upload-pictures",
  upload.array("pictures", 10), // Allow up to 10 files
  async (req, res) => {
    try {
      const { userId } = req.params;
      const pictureUrls = [];

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      // Upload each file to Cloudinary
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "user_pictures",
        });
        pictureUrls.push(result.secure_url);

        // Delete the temporary local file after upload
        fs.unlinkSync(file.path);
      }

      // Find user and get existing pictures
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // OPTIONAL: Limit total stored pictures (e.g., max 20)
      const maxPictures = 20;
      let updatedPictures = [...user.pictures, ...pictureUrls];

      if (updatedPictures.length > maxPictures) {
        // Remove old pictures to maintain limit
        const excessPictures = updatedPictures.length - maxPictures;
        const picturesToRemove = updatedPictures.slice(0, excessPictures);

        // Delete from Cloudinary
        for (const picUrl of picturesToRemove) {
          const publicId = picUrl.split("/").pop().split(".")[0]; // Extract ID
          await cloudinary.uploader.destroy(`user_pictures/${publicId}`);
        }

        // Keep only the latest allowed pictures
        updatedPictures = updatedPictures.slice(excessPictures);
      }

      // Update user's pictures array
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { pictures: updatedPictures, updatedAt: Date.now() },
        { new: true }
      );

      res.status(200).json({
        message: "Pictures uploaded successfully",
        user: updatedUser,
        pictureUrls,
      });
    } catch (err) {
      console.error("Pictures upload error:", err);
      res.status(400).json({ error: err.message });
    }
  }
);

router.post(
  "/:userId/upload-files",
  fileUpload.array("files", 10), // Field name is "files" and up to 10 files
  async (req, res) => {
    try {
      const { userId } = req.params;
      const fileUrls = [];

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      // Upload each file to Cloudinary
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "user_files",
          resource_type: "auto", // Allow Cloudinary to auto-detect file type
        });
        fileUrls.push(result.secure_url);
        // Delete the temporary local file after upload
        fs.unlinkSync(file.path);
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const updatedFiles = [...(user.files || []), ...fileUrls];
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { files: updatedFiles, updatedAt: Date.now() },
        { new: true }
      );

      res.status(200).json({
        message: "Files uploaded successfully",
        fileUrls,
        // user: updatedUser // Uncomment if updating user
      });
    } catch (err) {
      console.error("Files upload error:", err);
      res.status(400).json({ error: err.message });
    }
  }
);

// General Update Route (PUT /:userId)
router.put("/:userId/update", async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      name,
      profilePicture, // You can update this with a URL if needed
      pictures, // Same for pictures (if updating manually)
      bio,
      customMessage,
      status,
      phoneNumber,
      dateOfBirth,
      gender,
      socialMedia,
      preferences,
    } = req.body;

    // Update the user document with the provided fields
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
        updatedAt: Date.now(),
      },
      { new: true } // Return the updated document
    );

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Emit status change to all connected clients.
    const io = req.app.get("io");
    if (io) {
      io.emit("userStatusChange", {
        userId: updatedUser._id,
        status: updatedUser.status,
      });
    }

    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Delete a user
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

router.put("/:userId/block-contact", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.params;
    const { contactId } = req.body;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if contact exists
    const contact = await User.findById(contactId);
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    // Check if the contact is already blocked
    const isAlreadyBlocked = user.blockedContacts.some(
      (id) => id.toString() === contactId
    );

    let updatedUser;
    let message;

    if (isAlreadyBlocked) {
      // Unblock: remove the contact from blockedContacts using $pull
      updatedUser = await User.findByIdAndUpdate(
        userId,
        { $pull: { blockedContacts: contactId } },
        { new: true }
      );
      message = "Contact unblocked successfully";
    } else {
      // Block: add the contact to blockedContacts using $addToSet
      updatedUser = await User.findByIdAndUpdate(
        userId,
        { $addToSet: { blockedContacts: contactId } },
        { new: true }
      );
      message = "Contact blocked successfully";
    }

    // Optionally populate blockedContacts if needed:
    updatedUser = await updatedUser.populate(
      "blockedContacts",
      "name email profilePicture"
    );

    res.status(200).json({
      message,
      user: updatedUser,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:userId/remove-contact", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.params;
    const { contactId } = req.body;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if contact exists
    const contact = await User.findById(contactId);
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    // Remove contact from user's contacts list
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $pull: { contacts: contactId } },
      { new: true }
    ).populate("contacts", "name email profilePicture");

    // Remove user from the contact's contact list as well (optional, for mutual removal)
    await User.findByIdAndUpdate(contactId, { $pull: { contacts: userId } });

    res.status(200).json({
      message: "Contact removed successfully",
      user: updatedUser,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:userId/add-contact", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.params;
    const { email } = req.body; // Use email to identify the contact

    // Check if the main user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find the contact by email
    const contact = await User.findOne({ email });
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    // Add the contact's ID to the user's contacts array (avoid duplicates)
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { contacts: contact._id } },
      { new: true }
    ).populate("contacts", "name email pictures customMessage status bio");

    res.status(200).json({
      message: "Contact added successfully",
      user: updatedUser,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Friend Requests
 */
//Send
router.post("/friend-request", authenticateJWT, async (req, res) => {
  try {
    const io = req.app.get("io");

    const { senderId, recipientEmail } = req.body;
    if (!senderId || !recipientEmail) {
      return res
        .status(400)
        .json({ error: "Missing senderId or recipientEmail" });
    }

    // Look up the recipient by email
    const recipient = await User.findOne({ email: recipientEmail });
    if (!recipient) {
      return res.status(404).json({ error: "Recipient not found." });
    }

    // Prevent sending a request to yourself
    if (recipient._id.toString() === senderId) {
      return res
        .status(400)
        .json({ error: "Cannot send friend request to yourself." });
    }

    const sender = await User.findById(senderId);
    if (!sender) {
      return res.status(404).json({ error: "Sender not found." });
    }

    // Check if a friend request is already sent or if they are already friends
    if (
      sender.friendRequestsSent.includes(recipient._id) ||
      recipient.friendRequestsReceived.includes(senderId) ||
      sender.contacts.includes(recipient._id)
    ) {
      return res.status(400).json({
        error: "Friend request already exists or you're already friends.",
      });
    }

    // Add friend request
    sender.friendRequestsSent.push(recipient._id);
    recipient.friendRequestsReceived.push(senderId);

    await sender.save();
    await recipient.save();

    // Populate sender data for recipient's notification
    const populatedSender = await User.findById(senderId)
      .select("name email profilePicture status")
      .lean();

    // Emit to recipient
    io.to(recipient._id.toString()).emit("newFriendRequest", {
      request: {
        _id: populatedSender._id,
        name: populatedSender.name,
        profilePicture: populatedSender.profilePicture,
        status: populatedSender.status,
        email: populatedSender.email,
      },
      type: "received",
    });

    // Emit to sender (update their sent requests list)
    io.to(senderId).emit("newFriendRequest", {
      request: recipient._id,
      type: "sent",
    });

    res.status(200).json({ message: "Friend request sent." });
  } catch (error) {
    console.error("Error sending friend request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// routes/userRoutes.js
router.post("/friend-requests/:action", authenticateJWT, async (req, res) => {
  let action;

  const io = req.app.get("io");

  try {
    action = req.params.action; // 'accept' or 'reject'
    const { senderId } = req.body;
    const recipientId = req.user.userId;

    // Validate input
    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({ error: "Invalid action" });
    }

    if (!senderId) {
      return res.status(400).json({ error: "Sender ID required" });
    }

    // Find and validate users
    const [recipient, sender] = await Promise.all([
      User.findById(recipientId),
      User.findById(senderId),
    ]);

    if (!recipient || !sender) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify request exists
    if (!recipient.friendRequestsReceived.includes(senderId)) {
      return res.status(400).json({ error: "No pending friend request" });
    }

    const updates = [
      // Remove from requests using atomic operations
      User.updateOne(
        { _id: recipientId },
        { $pull: { friendRequestsReceived: senderId } }
      ),
      User.updateOne(
        { _id: senderId },
        { $pull: { friendRequestsSent: recipientId } }
      ),
    ];

    let populatedChat;
    if (action === "accept") {
      // Add contacts using atomic operations
      updates.push(
        User.updateOne(
          { _id: recipientId },
          { $addToSet: { contacts: senderId } }
        ),
        User.updateOne(
          { _id: senderId },
          { $addToSet: { contacts: recipientId } }
        )
      );

      // Chat creation
      const chat = await Chat.findOneAndUpdate(
        {
          participants: {
            $all: [
              { $elemMatch: { $eq: senderId } },
              { $elemMatch: { $eq: recipientId } },
            ],
            $size: 2,
          },
        },
        {
          $setOnInsert: {
            // Only set these fields on insert
            participants: [senderId, recipientId],
            messages: [],
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      ).populate({
        path: "participants",
        select: "name profilePicture status",
        match: { _id: { $in: [senderId, recipientId] } },
      });

      populatedChat = chat;

      updates.push(
        User.updateOne(
          { _id: recipientId },
          { $addToSet: { chats: chat._id } }
        ),
        User.updateOne({ _id: senderId }, { $addToSet: { chats: chat._id } })
      );

      // Get contact data AFTER database updates
      const [newContactForRecipient, newContactForSender] = await Promise.all([
        User.findById(senderId).select("name profilePicture status"),
        User.findById(recipientId).select("name profilePicture status"),
      ]);

      // Emit events
      io.to(recipientId).emit("friendRequestAccepted", {
        newContact: newContactForSender,
        removedRequestId: senderId,
        chat,
      });

      io.to(senderId).emit("friendRequestAccepted", {
        newContact: newContactForRecipient,
        removedRequestId: recipientId,
        chat,
      });
    }

    await Promise.all(updates);

    // Define emitData before using it
    const emitData = {
      recipientId,
      senderId,
      ...(action === "accept" && { chat: populatedChat }),
    };

    res.json({
      success: true,
      message: `Friend request ${action}ed`,
      ...emitData,
    });
  } catch (error) {
    console.error(`Friend request ${action} error:`, error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// When a user updates their status
router.put("/:userId/status", async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { status: req.body.status },
      { new: true }
    );

    // Notify all connected clients
    const io = req.app.get("io");
    io.emit("userStatusChange", {
      userId: user._id,
      status: user.status,
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
