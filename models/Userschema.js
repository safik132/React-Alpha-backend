// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: String,
  email: String,
  deviceTokens: [String],
});

module.exports = mongoose.model('User', userSchema);
