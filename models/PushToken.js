const mongoose = require('mongoose');

const pushTokenSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true }, // Ensure you have an index for efficient querying
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('PushToken', pushTokenSchema);
