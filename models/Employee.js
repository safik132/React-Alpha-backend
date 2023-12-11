const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
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
  teamHeadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeamHead',
    
  },
  // Add role field
  role: {
    type: String,
    enum: ['employee'],
    
},
lat: { type: Number, required: false },
lon: { type: Number, required: false },

});

module.exports = mongoose.model('Employee', EmployeeSchema);
