const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
require('dotenv').config();

const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcrypt');
require("dotenv").config()
const admin = require('firebase-admin');
const axios = require('axios');





// Import models
const TeamHead = require('./models/TeamHead');
const Employee = require('./models/Employee');
const PunchRecord = require('./models/PunchRecord');
const PushToken = require('./models/PushToken'); // Import the model
const Notification = require('./models/Notifications'); 

const app = express();
const userRoleMapping = {
  "employee": "employee",
  "teamHead": "teamHead",
  "superAdmin": "superAdmin"
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
  {/*----------------------------------------------------------------------- */}
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
  
{/*----------------------------------------------------------------------- */}
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
    
      // Prepare response object
      let response = {
        message: 'Logged in successfully',
        token,
        userId: user._id,
        role: role,
        username: user.username,
        email: user.email 
      };

  // Add lat and lon for employee role
      if (role === "employee" && user.lat && user.lon) {
        response.lat = user.lat;
        response.lon = user.lon;
      }
      console.log(user); // Add this line before res.json(response); to log the user object

      res.json(response);
    });
  
  

{/*----------------------------------------------------------------------- */}

  app.post('/api/teamHead/createEmployee', async (req, res) => {
    const { username, password, email, teamHeadId, userType ,lat, lon} = req.body;
  
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
      role: role,
      lat,
      lon
    });
  
    try {
      await newEmployee.save();
      res.json({ message: 'Employee created successfully' });
    } catch (error) {
      console.error('An error occurred while saving the employee:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  {/*----------------------------------------------------------------------- */}
  app.patch('/api/employee/updateLocation/:id', async (req, res) => {
    const { lat, lon } = req.body;
    try {
      const updatedEmployee = await Employee.findByIdAndUpdate(
        req.params.id, 
        { $set: { lat, lon } },
        { new: true }
      );
      console.log("Updated employee:", updatedEmployee); // Log the updated employee
      res.json(updatedEmployee);
    } catch (error) {
      console.error('Error updating employee location:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  
  
  
  
{/*----------------------------------------------------------------------- */}
  app.post('/api/employee/punch', async (req, res) => {
    const { type, employeeId, loggedInAt, lat, lon } = req.body; 
  
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
        lat, 
        lon
        
      });
      console.log(newRecord)
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
  
{/*----------------------------------------------------------------------- */}
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
  
{/*----------------------------------------------------------------------- */}
  
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
      
// Fetch all employees under a specific team head
app.get('/api/teamHead/:teamHeadId/employees', async (req, res) => {
  const teamHeadId = req.params.teamHeadId; // Extract teamHeadId from request parameters

  console.log("Fetching employees for Team Head ID:", teamHeadId);

  try {
    const employees = await Employee.find({ teamHeadId: teamHeadId });
    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ message: 'Internal Server Error', error });
  }
});

// Fetch all employees (for superAdmin)
// In your server file (e.g., app.js or server.js)
app.get('/api/teamHead/:teamHeadId/employeeLocations', async (req, res) => {
  const { teamHeadId } = req.params;

  try {
    const employees = await Employee.find({ teamHeadId: teamHeadId });
    
    const response = await Promise.all(employees.map(async (employee) => {
      // Fetch the most recent punch record for each employee
      const latestPunch = await PunchRecord.findOne({ employeeId: employee._id })
        .sort({ punchIn: -1 })
        .limit(1);

      // Determine if the employee is currently punched in
      const isPunchedIn = latestPunch && !latestPunch.punchOut;

      return {
        employeeId: employee._id,
        username: employee.username,
        lat: latestPunch ? latestPunch.lat : null,
        lon: latestPunch ? latestPunch.lon : null,
        punchInTime: latestPunch ? latestPunch.punchIn : null,
        punchOutTime: latestPunch ? latestPunch.punchOut : null,
        isPunchedIn
      };
    }));

    res.json(response.filter(item => item.lat && item.lon)); // Filter out any employees without location data
  } catch (error) {
    console.error('Error fetching employee locations:', error);
    res.status(500).json({ message: 'Internal Server Error', error });
  }
});

// Fetch the latest location for a specific employee
app.get('/api/employee/location/:userId', async (req, res) => {
  console.log("Fetching location for userId:", req.params.userId); // Log the userId being requested

  try {
    const employee = await Employee.findById(req.params.userId, 'lat lon');
    console.log("Found employee:", employee); // Log the found employee document

    if (!employee) {
      console.log("No employee found for userId:", req.params.userId);
      return res.status(404).json({ message: 'Employee not found' });
    }

    console.log("Sending location for userId:", req.params.userId, "Location:", { lat: employee.lat, lon: employee.lon });
    res.json({ lat: employee.lat, lon: employee.lon });
  } catch (error) {
    console.error('Error fetching employee location:', error);
    res.status(500).json({ message: 'Internal Server Error', error });
  }
});

// DELETE account API endpoint
app.delete('/api/account/delete/:userId', async (req, res) => {
  const { userId } = req.params; // Assume this is the ID of the user requesting deletion

  // Optional: Check if the user is authorized to delete this account
  // For example, make sure the userId from the token matches the userId parameter
  
  try {
    // Determine the role of the user
    let user = await Employee.findById(userId);
    let role = 'employee';
    if (!user) {
      user = await TeamHead.findById(userId);
      role = user ? user.role : null; // This might be 'teamHead' or 'superAdmin'
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Based on the role, perform the deletion
    switch(role) {
      case 'employee':
        await Employee.findByIdAndDelete(userId);
        break;
      case 'teamHead':
        // Optional: Handle team members before deletion
        await TeamHead.findByIdAndDelete(userId);
        break;
      case 'superAdmin':
        // Handle superAdmin deletion, if applicable
        break;
      default:
        return res.status(400).json({ message: 'Invalid user role' });
    }

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

//------------notification---------------------
app.post('/api/tokens', async (req, res) => {
  const { userId, token } = req.body;
  try {
    const existingToken = await PushToken.findOne({ userId });
    if (existingToken) {
      existingToken.token = token; // Update the token
      await existingToken.save();
      console.log('Token updated in database');
    } else {
      await new PushToken({ userId, token }).save();
      console.log('Token saved to database');
    }
    res.status(200).send({ message: 'Token received and updated successfully' });
  } catch (error) {
    console.error('Error saving or updating token:', error);
    res.status(500).send({ message: 'Failed to save or update token' });
  }
});

// In your Express app (e.g., index.js or app.js)

app.post('/api/send-notifications', async (req, res) => {
  const { title, body } = req.body;

  try {
    const tokens = await PushToken.find().select('token -_id').lean();
    const messages = tokens.map(({ token }) => ({
      to: token,
      sound: 'default',
      title: title || "New Notification",
      body: body || "This is the notification body.",
      data: { withSome: 'data' },
    }));

    // Send notifications
    await axios.post('https://exp.host/--/api/v2/push/send', messages, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
    });

    // Store notification in the database
    await new Notification({
      title,
      body,
      data: { withSome: 'data' },
      tokens: tokens.map(t => t.token) // Store only the tokens
    }).save();

    res.status(200).json({ message: 'Notifications sent and stored successfully.' });
  } catch (error) {
    console.error('Failed to send notifications:', error);
    res.status(500).json({ error: 'Failed to send and store notifications' });
  }
});

app.get('/api/notifications', async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 }); // Get most recent notifications first
    res.json(notifications);
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});



const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
