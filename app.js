const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
require('dotenv').config();

const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcrypt');
require("dotenv").config()


// Import models
const TeamHead = require('./models/TeamHead');
const Employee = require('./models/Employee');
const PunchRecord = require('./models/PunchRecord');

const app = express();
const userRoleMapping = {
  "employee": "employee",
  "teamHead": "teamHead",
  // ... any other roles you add in the future
}

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI , {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.log(err));

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Validation middleware
const validateTeamHead = (req, res, next) => {
    const { username, password, email } = req.body;
    if (!username || !password || !email) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    next();
  };
  
  // Updated /api/teamHead/create endpoint
  app.post('/api/teamHead/create', validateTeamHead, async (req, res) => {
    try {
      const { username, password, email, superAdminId, userType } = req.body;
  
      const existingTeamHead = await TeamHead.findOne({ $or: [{ username }, { email }] });
      if (existingTeamHead) {
        return res.status(400).json({ message: 'Username or email already exists' });
      }
  
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
  
      const role = userRoleMapping[userType]; // Get role from mapping

        const newTeamHead = new TeamHead({ 
            username, 
            password: hashedPassword, 
            email, 
            superAdminId,
            role: role 
        });
  
      await newTeamHead.save();
      res.status(201).json({ message: 'TeamHead created successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  

  app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
  
    // Check TeamHead collection first
    let user = await TeamHead.findOne({ email });
  
    let role; // Declare role without assigning yet
    if (user) {
      role = user.role; // Assign role based on database value (either "teamHead" or "superAdmin")
    } else {
      // If not found in TeamHead, check Employee collection
      user = await Employee.findOne({ email });
      if (user) {
        role = "employee";
      }
    }
  
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
  
    // Compare entered password with stored hashed password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid password' });
    }
  
    // Generate token
    const token = jwt.sign({ id: user._id, role }, 'your_secret_key', { expiresIn: '1h' });
  
    // Include user's ID in the response
    res.json({ message: 'Logged in successfully', token, userId: user._id, role: role, username: user.username });
  });
  
  



  app.post('/api/teamHead/createEmployee', async (req, res) => {
    const { username, password, email, teamHeadId, userType } = req.body;
  
    // Basic validation
    if (!username || !password || !email || !teamHeadId) {
      return res.status(400).json({ message: 'All fields are required' });
    }
  
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const role = userRoleMapping[userType];
    
    // Create and save new employee
    const newEmployee = new Employee({
      username,
      password: hashedPassword,
      email,
      teamHeadId,
      role: role
    });
  
    try {
      await newEmployee.save();
      res.json({ message: 'Employee created successfully' });
    } catch (error) {
      console.error('An error occurred while saving the employee:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  
  

  app.post('/api/employee/punch', async (req, res) => {
    const { type, employeeId, loggedInAt } = req.body; 
  
    if (!type || !employeeId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
  
    const dateObj = new Date();
    const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${dateObj.getFullYear()}`;
    
    if (type === 'in') {
      const newRecord = new PunchRecord({
        employeeId,
        date: dateObj,
        formattedDate: formattedDate,
        punchIn: dateObj,
        loggedInAt: new Date(loggedInAt),
      });
      await newRecord.save();
    } else if (type === 'out') {
      const record = await PunchRecord.findOne({
        employeeId,
        formattedDate: formattedDate,
      }).sort({ punchIn: -1 });
  
      if (record) {
        record.punchOut = dateObj;
        await record.save();
      }
    }
  
    res.json({ message: 'Punch recorded successfully' });
  });
  

  app.get('/api/teamHead/records', async (req, res) => {
    const { startDate, endDate, userId, role } = req.query;
  
    let query = {};
  
    if (startDate && endDate) {
      const start = formatDateToDDMMYYYY(new Date(startDate));
      const end = formatDateToDDMMYYYY(new Date(endDate));
      query['formattedDate'] = { $gte: start, $lte: end };
    }
  
    try {
      let records;
      if (role === 'superAdmin') {
        records = await PunchRecord.find(query).populate('employeeId');
      } else {
        records = await PunchRecord.find(query)
        .populate({
          path: 'employeeId',
          match: { teamHeadId: new mongoose.Types.ObjectId(userId) },
        })
          .exec();
        // Filter out records that do not match the teamHeadId after population
        records = records.filter(record => record.employeeId && record.employeeId.teamHeadId.equals(userId));
      }
  
      res.json(records);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  
  
  const formatDateToDDMMYYYY = (date) => {
    return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
  };
  

  
  app.get('/api/employee/lastPunch', async (req, res) => {
    const { employeeId } = req.query;
    if (!employeeId) {
      return res.status(400).json({ message: 'Missing required field' });
    }
  
    const dateObj = new Date();
    const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${dateObj.getFullYear()}`;
  
    const record = await PunchRecord.findOne({ employeeId, formattedDate })
      .sort({ date: -1 })
      .limit(1);
  
    return res.json(record);
  });
  app.get('/api/superAdmin/teamHeads', async (req, res) => {
    try {
      const teamHeads = await TeamHead.find({ role: 'teamHead' });
      res.json(teamHeads);
    } catch (error) {
      res.status(500).json({ message: 'Internal Server Error', error });
    }
  });
  app.get('/api/superAdmin/employees/:teamHeadId', async (req, res) => {
    try {
      const { teamHeadId } = req.params;
      const employees = await Employee.find({ teamHeadId });
      res.json(employees);
    } catch (error) {
      res.status(500).json({ message: 'Internal Server Error', error });
    }
  });
  app.put('/api/superAdmin/employees/:employeeId', async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { newTeamHeadId } = req.body;
      const updatedEmployee = await Employee.findByIdAndUpdate(employeeId, { teamHeadId: newTeamHeadId }, { new: true });
      res.json(updatedEmployee);
    } catch (error) {
      res.status(500).json({ message: 'Internal Server Error', error });
    }
  });
      


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
