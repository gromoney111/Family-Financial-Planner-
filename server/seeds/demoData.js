/**
 * Demo Data Seed - GromoFinance Public Demo
 * Generates realistic family financial data for demo environment
 * 1 Admin + 5 Members, 500+ transactions, loans, investments, insurance
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Demo family members
const DEMO_FAMILY = {
  admin: { name: 'Rajesh Sharma', email: 'demo@gromofinance.com', phone: '9876543210', relation: 'Self', role: 'admin' },
  members: [
    { name: 'Priya Sharma', email: 'priya@demo.com', phone: '9876543211', relation: 'Spouse', role: 'member' },
    { name: 'Arjun Sharma', email: 'arjun@demo.com', phone: '9876543212', relation: 'Son', role: 'member' },
    { name: 'Ananya Sharma', email: 'ananya@demo.com', phone: '9876543213', relation: 'Daughter', role: 'member' },
    { name: 'Suresh Sharma', email: 'suresh@demo.com', phone: '9876543214', relation: 'Father', role: 'member' },
    { name: 'Kamla Sharma', email: 'kamla@demo.com', phone: '9876543215', relation: 'Mother', role: 'member' }
  ]
};

const DEMO_PASSWORD = 'demo123';
const DEMO_FAMILY_CODE = 'demo-sharma-family';

module.exports = { DEMO_FAMILY, DEMO_PASSWORD, DEMO_FAMILY_CODE };
