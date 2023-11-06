const mongoose = require('mongoose');

const TeamHeadSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  superAdminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeamHead'
    
  },
  role: {
    type: String,
    enum: ['teamHead', 'superAdmin'],
    
}



});

module.exports = mongoose.model('TeamHead', TeamHeadSchema);
