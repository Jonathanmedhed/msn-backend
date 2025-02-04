const { server } = require("../server");

module.exports = async () => {
  console.log("Running global setup...");

  if (!server.listening) {
    const PORT = process.env.PORT || 5000;
    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`Test server running on port ${PORT}`);
  } else {
    console.log("Server is already running.");
  }

  return async () => {
    console.log("Running global teardown...");

    if (server.listening) {
      await new Promise((resolve) => server.close(resolve));
      console.log("Test server stopped");
    } else {
      console.log("Server is not running.");
    }
  };
};
