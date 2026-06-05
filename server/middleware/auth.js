const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Subscription = require('../models/Subscription');

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided. Please login.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or inactive.' });
    }

    req.user = user;
    req.userId = user._id;
    req.familyId = user.familyId;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

// Check if user is admin of the family
const requireAdmin = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }
  next();
};

// Require Pro (or active trial) subscription for premium features
const requirePro = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({ familyId: req.familyId });
    
    if (!subscription) {
      return res.status(403).json({ 
        success: false, 
        message: 'This feature requires a Pro subscription. Start your free trial or upgrade!',
        requireUpgrade: true 
      });
    }

    if (subscription.plan === 'free') {
      return res.status(403).json({ 
        success: false, 
        message: 'This feature requires a Pro subscription. Start your free trial or upgrade!',
        requireUpgrade: true 
      });
    }

    if (!subscription.isValid()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Your subscription has expired. Please renew to continue using Pro features.',
        requireUpgrade: true 
      });
    }

    req.subscription = subscription;
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to verify subscription.' });
  }
};

// Check specific feature access
const requireFeature = (featureName) => {
  return async (req, res, next) => {
    try {
      const subscription = await Subscription.findOne({ familyId: req.familyId });
      
      if (!subscription || !subscription.isValid()) {
        return res.status(403).json({ 
          success: false, 
          message: `Upgrade to access ${featureName}.`,
          requireUpgrade: true 
        });
      }

      if (subscription.features && !subscription.features[featureName]) {
        return res.status(403).json({ 
          success: false, 
          message: `This feature requires a higher plan. Upgrade to unlock ${featureName}.`,
          requireUpgrade: true 
        });
      }

      req.subscription = subscription;
      next();
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to verify feature access.' });
    }
  };
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'fallback_secret_key',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

module.exports = { authenticate, requireAdmin, requirePro, requireFeature, generateToken };
