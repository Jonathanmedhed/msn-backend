const jwt = require("jsonwebtoken");

module.exports.authenticateUser = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Check if the Authorization header is present
  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  // Expect the header to have the format "Bearer <token>"
  const tokenParts = authHeader.split(" ");
  if (tokenParts[0] !== "Bearer" || tokenParts.length !== 2) {
    return res
      .status(401)
      .json({ message: "Unauthorized: Invalid token format" });
  }

  const token = tokenParts[1];

  // Verify the token using your secret key
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      // If the token is invalid or expired, respond with Unauthorized
      return res.status(401).json({
        message: "Unauthorized: Invalid or expired token",
        error: err.message,
      });
    }

    // Attach the decoded token (user data) to the request object for downstream use
    req.user = decoded;
    next();
  });
};
