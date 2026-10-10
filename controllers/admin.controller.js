const pool = require('../db');
const {
  createLinkedAccount,
  createStakeholder,
  addBankAccount,
} = require('../services/razorpayRoute.service');

// POST /web-api/admin/onboard
exports.onboardAdmin = async (req, res) => {
  const { communityId, name, email, pan, street, street2, city, pincode, phone, state } = req.body;

  if (!communityId || !name || !email || !phone) {
    return res.status(400).json({ message: 'Missing required fields: communityId, name, email, phone are required' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT razorpay_account_id FROM communities WHERE id = $1',
      [communityId],
    );
    if (!rows.length) return res.status(404).json({ message: 'Community not found' });
    if (rows[0].razorpay_account_id) {
      return res.status(400).json({ message: 'Already has a linked Razorpay account' });
    }

    // Step 1: Create linked account
    const rzpAccount = await createLinkedAccount({ name, email, pan, street, street2, city, pincode, phone, state });

    // Step 2: Create stakeholder (required by Razorpay before bank details)
    await createStakeholder(rzpAccount.id, { holderName: name, email, phone, pan });

    // Save account ID to DB
    await pool.query(
      `UPDATE communities SET razorpay_account_id = $1, kyc_status = 'pending' WHERE id = $2`,
      [rzpAccount.id, communityId],
    );

    return res.json({ success: true, razorpayAccountId: rzpAccount.id });
  } catch (err) {
    console.error('onboardAdmin error:', err.response?.data || err.message);
    return res.status(500).json({ message: 'Failed to create linked account' });
  }
};

// POST /web-api/admin/bank
exports.addBank = async (req, res) => {
  const { communityId, holderName, ifsc, accountNumber } = req.body;

  try {
    const { rows } = await pool.query(
      'SELECT razorpay_account_id FROM communities WHERE id = $1',
      [communityId],
    );
    if (!rows.length || !rows[0].razorpay_account_id) {
      return res.status(400).json({ message: 'No linked Razorpay account found. Onboard first.' });
    }

    await addBankAccount(rows[0].razorpay_account_id, { holderName, ifsc, accountNumber });
    return res.json({ success: true, message: 'Bank account added' });
  } catch (err) {
    console.error('addBank error:', err.response?.data || err.message);
    return res.status(500).json({ message: 'Failed to add bank account' });
  }
};

// POST /web-api/admin/connect
exports.connectExistingAccount = async (req, res) => {
  const { communityId, razorpayAccountId } = req.body;

  if (!communityId || !razorpayAccountId) {
    return res.status(400).json({ message: 'Missing communityId or razorpayAccountId' });
  }

  try {
    await pool.query(
      `UPDATE communities SET razorpay_account_id = $1, kyc_status = 'approved' WHERE id = $2`,
      [razorpayAccountId, communityId],
    );
    return res.json({ success: true, message: 'Existing account connected' });
  } catch (err) {
    console.error('connectExistingAccount error:', err.message);
    return res.status(500).json({ message: 'Failed to connect account' });
  }
};