const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const { authenticateUser } = require("../middleware/auth");
const User = require("../models/User");

router.post("/change-password", authenticateUser, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.userId; // Using userId from the token payload

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(200)
        .json({ success: false, message: "User not found." });
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res
        .status(200)
        .json({ success: false, message: "Password incorrect." });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    return res
      .status(200)
      .json({ success: true, message: "Password changed successfully." });
  } catch (error) {
    console.error("Error in change-password route:", error);
    return res
      .status(200)
      .json({
        success: false,
        message: "Server error. Please try again later.",
      });
  }
});

module.exports = router;
