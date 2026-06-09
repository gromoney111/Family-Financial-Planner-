const nodemailer = require('nodemailer');
const Loan = require('../models/Loan');
const Investment = require('../models/Investment');
const User = require('../models/User');
const Family = require('../models/Family');

// Create transporter
const createTransporter = () => {
  const port = parseInt(process.env.SMTP_PORT) || 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Send EMI reminder email
const sendEMIReminderEmail = async (user, loan, daysUntil, nextDueDate) => {
  const mailOptions = {
    from: `"GromoFinance" <${process.env.SMTP_USER || 'noreply@gromofinance.com'}>`,
    to: user.email,
    subject: `🔔 EMI Due in ${daysUntil} days - ${loan.type} (${loan.lender})`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;border-radius:12px;">
        <div style="text-align:center;padding:20px 0;border-bottom:2px solid #f59e0b;">
          <h1 style="color:#0f172a;margin:0;">Gromo<span style="color:#f59e0b;">Finance</span></h1>
          <p style="color:#64748b;margin-top:4px;">Payment Reminder</p>
        </div>
        <div style="padding:30px 20px;">
          <h2 style="color:#dc2626;text-align:center;">⚠️ EMI Payment Due in ${daysUntil} Day${daysUntil > 1 ? 's' : ''}!</h2>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin:20px 0;">
            <table style="width:100%;font-size:14px;color:#475569;">
              <tr><td style="padding:8px 0;font-weight:600;">Loan Type</td><td style="text-align:right;">${loan.type}</td></tr>
              <tr><td style="padding:8px 0;font-weight:600;">Lender / Bank</td><td style="text-align:right;">${loan.lender}</td></tr>
              <tr><td style="padding:8px 0;font-weight:600;">EMI Amount</td><td style="text-align:right;color:#dc2626;font-weight:700;">₹${loan.emi.toLocaleString('en-IN')}</td></tr>
              <tr><td style="padding:8px 0;font-weight:600;">Due Date</td><td style="text-align:right;">${nextDueDate.toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})}</td></tr>
              <tr><td style="padding:8px 0;font-weight:600;">Member</td><td style="text-align:right;">${loan.memberName}</td></tr>
              <tr><td style="padding:8px 0;font-weight:600;">EMIs Paid</td><td style="text-align:right;">${loan.emisPaid} / ${loan.tenure}</td></tr>
            </table>
          </div>
          <p style="color:#475569;font-size:14px;text-align:center;">
            Please ensure sufficient balance in your account to avoid late payment charges.
          </p>
          <div style="text-align:center;margin-top:20px;">
            <a href="${process.env.FRONTEND_URL || 'https://gromofinance.com'}" style="display:inline-block;padding:12px 28px;background:#f59e0b;color:#fff;font-weight:600;text-decoration:none;border-radius:8px;">
              View in Dashboard →
            </a>
          </div>
        </div>
      </div>
    `
  };

  try {
    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('EMI reminder email error:', error.message);
    return { success: false, error: error.message };
  }
};

// Send SIP reminder email
const sendSIPReminderEmail = async (user, investment, daysUntil, nextDueDate) => {
  const mailOptions = {
    from: `"GromoFinance" <${process.env.SMTP_USER || 'noreply@gromofinance.com'}>`,
    to: user.email,
    subject: `🔔 SIP Due in ${daysUntil} days - ${investment.name}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;border-radius:12px;">
        <div style="text-align:center;padding:20px 0;border-bottom:2px solid #0d9488;">
          <h1 style="color:#0f172a;margin:0;">Gromo<span style="color:#f59e0b;">Finance</span></h1>
          <p style="color:#64748b;margin-top:4px;">SIP Reminder</p>
        </div>
        <div style="padding:30px 20px;">
          <h2 style="color:#0d9488;text-align:center;">📅 SIP Payment Due in ${daysUntil} Day${daysUntil > 1 ? 's' : ''}!</h2>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin:20px 0;">
            <table style="width:100%;font-size:14px;color:#475569;">
              <tr><td style="padding:8px 0;font-weight:600;">Investment Type</td><td style="text-align:right;">${investment.type}</td></tr>
              <tr><td style="padding:8px 0;font-weight:600;">Scheme / Name</td><td style="text-align:right;">${investment.name}</td></tr>
              <tr><td style="padding:8px 0;font-weight:600;">SIP Amount</td><td style="text-align:right;color:#0d9488;font-weight:700;">₹${investment.monthlyContribution.toLocaleString('en-IN')}</td></tr>
              <tr><td style="padding:8px 0;font-weight:600;">Due Date</td><td style="text-align:right;">${nextDueDate.toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})}</td></tr>
              <tr><td style="padding:8px 0;font-weight:600;">Member</td><td style="text-align:right;">${investment.memberName}</td></tr>
            </table>
          </div>
          <p style="color:#475569;font-size:14px;text-align:center;">
            Ensure your bank account has sufficient balance for auto-debit.
          </p>
          <div style="text-align:center;margin-top:20px;">
            <a href="https://gromoneycapital.com/" style="display:inline-block;padding:12px 28px;background:#059669;color:#fff;font-weight:600;text-decoration:none;border-radius:8px;margin-right:10px;">
              Manage via GroMoneyCapital
            </a>
            <a href="${process.env.FRONTEND_URL || 'https://gromofinance.com'}" style="display:inline-block;padding:12px 28px;background:#0f172a;color:#f59e0b;font-weight:600;text-decoration:none;border-radius:8px;">
              View Dashboard
            </a>
          </div>
        </div>
      </div>
    `
  };

  try {
    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('SIP reminder email error:', error.message);
    return { success: false, error: error.message };
  }
};

// Generate WhatsApp reminder link
const generateWhatsAppReminder = (phone, name, type, amount, dueDate, daysUntil) => {
  const msg = `🔔 *GromoFinance Reminder*\n\nHi ${name}!\n\nYour *${type}* payment of *₹${amount.toLocaleString('en-IN')}* is due in *${daysUntil} day${daysUntil > 1 ? 's' : ''}* (${dueDate.toLocaleDateString('en-IN', {day:'2-digit',month:'short'})}).\n\nPlease ensure sufficient balance.\n\n📊 Track at: https://gromofinance.com\n💰 Invest: https://gromoneycapital.com`;
  const cleanPhone = phone.replace(/\D/g, '');
  const fullPhone = cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone;
  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
};

// Main function: Check and send reminders for all due EMIs and SIPs
const checkAndSendReminders = async () => {
  const today = new Date();
  const reminderDays = [1, 3]; // Send reminders 1 day and 3 days before due
  let emailsSent = 0;
  let whatsappLinks = [];

  try {
    // === EMI REMINDERS ===
    const activeLoans = await Loan.find({ status: 'active' });
    for (const loan of activeLoans) {
      const dueDay = loan.emiDueDay || 5;
      let nextDue = new Date(today.getFullYear(), today.getMonth(), dueDay);
      if (nextDue < today) nextDue.setMonth(nextDue.getMonth() + 1);
      const daysUntil = Math.ceil((nextDue - today) / (1000 * 60 * 60 * 24));

      if (reminderDays.includes(daysUntil)) {
        // Find family admin to send reminder to
        const admin = await User.findOne({ familyId: loan.familyId, role: 'admin' });
        if (admin) {
          await sendEMIReminderEmail(admin, loan, daysUntil, nextDue);
          emailsSent++;
          // Generate WhatsApp link
          const waLink = generateWhatsAppReminder(admin.phone, admin.name, `${loan.type} EMI (${loan.lender})`, loan.emi, nextDue, daysUntil);
          whatsappLinks.push({ user: admin.name, type: 'EMI', link: waLink });
        }
      }
    }

    // === SIP REMINDERS ===
    const activeSIPs = await Investment.find({ status: 'active', monthlyContribution: { $gt: 0 } });
    for (const inv of activeSIPs) {
      const dueDay = inv.paymentDueDay || 5;
      let nextDue = new Date(today.getFullYear(), today.getMonth(), dueDay);
      if (nextDue < today) nextDue.setMonth(nextDue.getMonth() + 1);
      const daysUntil = Math.ceil((nextDue - today) / (1000 * 60 * 60 * 24));

      if (reminderDays.includes(daysUntil)) {
        const admin = await User.findOne({ familyId: inv.familyId, role: 'admin' });
        if (admin) {
          await sendSIPReminderEmail(admin, inv, daysUntil, nextDue);
          emailsSent++;
          const waLink = generateWhatsAppReminder(admin.phone, admin.name, `${inv.type} SIP (${inv.name})`, inv.monthlyContribution, nextDue, daysUntil);
          whatsappLinks.push({ user: admin.name, type: 'SIP', link: waLink });
        }
      }
    }

    console.log(`[Reminders] Sent ${emailsSent} reminder emails. WhatsApp links generated: ${whatsappLinks.length}`);
    return { success: true, emailsSent, whatsappLinks };
  } catch (error) {
    console.error('[Reminders] Error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { 
  checkAndSendReminders, 
  sendEMIReminderEmail, 
  sendSIPReminderEmail, 
  generateWhatsAppReminder 
};
