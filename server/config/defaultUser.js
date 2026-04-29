const User = require('../models/User');

const DEFAULT_USER = {
  username: 'admin',
  email: 'admin@panel.local',
  password: 'admin123',
  role: 'admin'
};

async function ensureDefaultUser() {
  try {
    const existingUser = await User.findOne({ email: DEFAULT_USER.email });
    
    if (!existingUser) {
      const user = new User(DEFAULT_USER);
      await user.save();
      console.log('Default admin user created');
      console.log('Email:', DEFAULT_USER.email);
      console.log('Password:', DEFAULT_USER.password);
    }
  } catch (error) {
    console.error('Error creating default user:', error);
  }
}

module.exports = { ensureDefaultUser, DEFAULT_USER };
