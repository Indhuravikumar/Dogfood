const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Helper to generate signed JWT token
const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );
};

// Email validation regex helper
const isValidEmail = (email) => {
  const re = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  return re.test(email);
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const { name, email, password, role, skills, avatar } = req.body;

    // 1. Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password',
      });
    }

    // 2. Validate email format
    const cleanedEmail = email.toLowerCase().trim();
    if (!isValidEmail(cleanedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
      });
    }

    // 3. Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    // 4. Validate role if supplied
    const validRoles = ['participant', 'organizer', 'judge'];
    const assignedRole = role ? role.toLowerCase().trim() : 'participant';
    if (!validRoles.includes(assignedRole)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      });
    }

    // 5. Check if email already registered (Handle duplicate email with 409 Conflict)
    const existingUser = await User.findOne({ email: cleanedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists',
      });
    }

    // 6. Create user (Mongoose pre-save hook handles bcrypt password hashing)
    const user = await User.create({
      name: name.trim(),
      email: cleanedEmail,
      password,
      role: assignedRole,
      skills: Array.isArray(skills) ? skills : [],
      avatar: avatar || '',
    });

    // 7. Generate JWT token
    const token = generateToken(user._id, user.role);

    // 8. Return response (user.toJSON() ensures password is excluded)
    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during user registration',
    });
  }
};

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    const cleanedEmail = email.toLowerCase().trim();

    // 2. Find user by email and explicitly select password (since select: false by default)
    const user = await User.findOne({ email: cleanedEmail }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // 3. Verify password hash using instance method
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // 4. Generate JWT token
    const token = generateToken(user._id, user.role);

    // 5. Return success response (password excluded via toJSON)
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during user login',
    });
  }
};

/**
 * @desc    Get current authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private (Requires Bearer token)
 */
const getMe = async (req, res) => {
  try {
    // req.user is attached by protect middleware
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving user profile',
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
};
