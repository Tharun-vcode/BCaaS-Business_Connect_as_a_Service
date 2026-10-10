const axios = require('axios');

const RZP_AUTH = {
  auth: {
    username: process.env.RAZOR_KEY,
    password: process.env.RAZOR_SECRET,
  },
};

const DEFAULT_COMMISSION_PERCENT = parseFloat(
  process.env.PLATFORM_COMMISSION_PERCENT || '10',
);

// ── Create a Razorpay linked account for a new admin ─────────────────────────
async function createLinkedAccount({ name, email, pan, street, street2, city, pincode, phone, state }) {
  const formattedPhone = phone
    ? phone.replace(/^\+91/, '').replace(/\s/g, '').slice(-10)
    : '9000090000';

  const formattedState = state ? state.toUpperCase() : 'KARNATAKA';

  const body = {
    email,
    phone: formattedPhone,
    type: 'route',
    legal_business_name: name,
    business_type: 'individual',
    contact_name: name,
    profile: {
      category: 'services',
      subcategory: 'consulting_and_outsourcing',
      addresses: {
        registered: {
          street1:     street  || '123 Main St',
          street2:     street2 || 'Near Main Road',
          city:        city    || 'Bengaluru',
          state:       formattedState,
          postal_code: pincode || '560001',
          country:     'IN',
        },
      },
    },
  };

  if (pan) {
    body.legal_info = { pan };
  }

  const { data } = await axios.post(
    'https://api.razorpay.com/v2/accounts',
    body,
    RZP_AUTH,
  );
  return data;
}

// ── Step 1: Create stakeholder (person details) ───────────────────────────────
async function createStakeholder(accountId, { holderName, email, phone, pan }) {
  const body = {
    name: holderName,
    email,
    relationship: {
      director: true,
    },
    phone: {
      primary: phone || '9999999999',
      secondary: phone || '9999999999',
    },
    addresses: {
      residential: {
        street:      '123 Main St',
        city:        'Bengaluru',
        state:       'KARNATAKA',
        postal_code: '560001',
        country:     'IN',
      },
    },
  };

  if (pan) {
    body.kyc = { pan };
  }

  const { data } = await axios.post(
    `https://api.razorpay.com/v2/accounts/${accountId}/stakeholders`,
    body,
    RZP_AUTH,
  );
  return data;
}

// ── Step 2: Request product configuration (enable route product) ──────────────
async function requestProductConfig(accountId) {
  const { data } = await axios.post(
    `https://api.razorpay.com/v2/accounts/${accountId}/products`,
    {
      product_name: 'route',
      tnc_accepted: true,
    },
    RZP_AUTH,
  );
  return data; // data.id = product_id
}

// ── Step 3: Update product config with bank account details ──────────────────
async function addBankAccount(accountId, { holderName, ifsc, accountNumber }) {
  // First request product config to get product_id
  let productId;
  try {
    const product = await requestProductConfig(accountId);
    productId = product.id;
  } catch (err) {
    // If product already requested, fetch it
    const { data } = await axios.get(
      `https://api.razorpay.com/v2/accounts/${accountId}/products`,
      RZP_AUTH,
    );
    productId = data?.items?.[0]?.id;
  }

  if (!productId) {
    throw new Error('Could not get product ID for account');
  }

  // Now update product with bank account details
  const { data } = await axios.patch(
    `https://api.razorpay.com/v2/accounts/${accountId}/products/${productId}`,
    {
      settlements: {
        account_number: accountNumber,
        ifsc_code:      ifsc,
        beneficiary_name: holderName,
      },
      tnc_accepted: true,
    },
    RZP_AUTH,
  );
  return data;
}

// ── Calculate split amounts ────────────────────────────────────────────────────
function calcSplit(totalPaise, commissionPercent = DEFAULT_COMMISSION_PERCENT) {
  const parsedCommission = Number.isFinite(Number(commissionPercent))
    ? Number(commissionPercent)
    : DEFAULT_COMMISSION_PERCENT;
  const normalizedCommission = parsedCommission / 100;
  const adminAmount = Math.round(totalPaise * (1 - normalizedCommission));
  const platformAmount = totalPaise - adminAmount;
  return { adminAmount, platformAmount };
}

// ── Route payment to admin after capture ──────────────────────────────────────
async function routePaymentToAdmin(paymentId, adminAccountId, adminAmountPaise) {
  const { data } = await axios.post(
    `https://api.razorpay.com/v1/payments/${paymentId}/transfers`,
    {
      transfers: [
        {
          account: adminAccountId,
          amount: adminAmountPaise,
          currency: 'INR',
          on_hold: 0,
        },
      ],
    },
    RZP_AUTH,
  );
  return data;
}

// ── Reverse a transfer (for refunds) ──────────────────────────────────────────
async function reverseTransfer(transferId, amountPaise) {
  const { data } = await axios.post(
    `https://api.razorpay.com/v1/transfers/${transferId}/reversals`,
    { amount: amountPaise },
    RZP_AUTH,
  );
  return data;
}

module.exports = {
  createLinkedAccount,
  createStakeholder,
  requestProductConfig,
  addBankAccount,
  calcSplit,
  routePaymentToAdmin,
  reverseTransfer,
};
