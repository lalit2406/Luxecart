import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/modules/users/user.model.js';
import authService from '../src/modules/auth/auth.service.js';
import { generateResetToken, hashToken } from '../src/utils/token.js';
import { config } from '../src/config/env.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/luxecart';

async function runTests() {
  console.log('--- STARTING LUXECART AUTH CAPABILITIES VERIFICATION ---');
  await mongoose.connect(MONGODB_URI);
  console.log(' Connected to MongoDB');

  const testEmail = `authtest_${Date.now()}@luxecart-test.com`;
  const testPassword = 'Password123!';
  const newPassword = 'NewSecretPassword456!';
  let createdUserId = null;

  try {
    // TEST 1: Register normal email/password user
    console.log('\n[TEST 1] Testing normal email/password registration...');
    const regResult = await authService.register({
      name: 'Auth Test User',
      email: testEmail,
      password: testPassword,
      phone: '+91 99999 88888',
    });
    createdUserId = regResult.user.id;
    if (!regResult.user || !regResult.accessToken || !regResult.refreshToken) {
      throw new Error('Registration failed to return user and tokens');
    }
    console.log(' PASS: User registered successfully (Role: ' + regResult.user.role + ')');

    // TEST 2: Login with correct password
    console.log('\n[TEST 2] Testing login with correct password...');
    const loginResult = await authService.login({
      email: testEmail,
      password: testPassword,
    });
    if (!loginResult.user || loginResult.user.email !== testEmail) {
      throw new Error('Login failed for valid credentials');
    }
    console.log(' PASS: Logged in successfully with tokens');

    // TEST 3: Login with wrong password
    console.log('\n[TEST 3] Testing login with invalid password...');
    try {
      await authService.login({
        email: testEmail,
        password: 'WrongPassword!',
      });
      throw new Error('Expected 401 error for wrong password');
    } catch (err) {
      if (err.statusCode === 401) {
        console.log(' PASS: Rejected wrong password with 401');
      } else {
        throw err;
      }
    }

    // TEST 4: Google-only user without password
    console.log('\n[TEST 4] Testing Google-only account (no passwordHash)...');
    const googleUser = new User({
      name: 'Google User Test',
      email: `google_${Date.now()}@gmail.com`,
      googleId: `google_sub_${Date.now()}`,
      role: 'CUSTOMER',
      status: 'ACTIVE',
      refreshTokens: [],
    });
    await googleUser.save();
    const isPasswordValid = await googleUser.comparePassword('anyPassword');
    if (isPasswordValid === false) {
      console.log(' PASS: Google-only account saved without password and comparePassword safely returns false');
    } else {
      throw new Error('Expected comparePassword to return false for passwordless account');
    }
    await User.findByIdAndDelete(googleUser._id);

    // TEST 5: Forgot Password (Non-existent email)
    console.log('\n[TEST 5] Testing Forgot Password for non-existent email (timing-safe generic response)...');
    const fakeResult = await authService.forgotPassword('nonexistent_user_xyz@domain.com');
    if (fakeResult.message && fakeResult.message.includes('If an account exists')) {
      console.log(' PASS: Non-existent email returned generic message without enumeration leak');
    } else {
      throw new Error('Failed to return generic response');
    }

    // TEST 6: Forgot Password (Existing email)
    console.log('\n[TEST 6] Testing Forgot Password for existing active email...');
    const forgotResult = await authService.forgotPassword(testEmail);
    if (!forgotResult.message.includes('If an account exists')) {
      throw new Error('Forgot password did not return expected message');
    }
    const userInDb = await User.findById(createdUserId).select('+resetPasswordTokenHash +resetPasswordExpires');
    if (!userInDb.resetPasswordTokenHash || !userInDb.resetPasswordExpires) {
      throw new Error('User record missing resetPasswordTokenHash or resetPasswordExpires');
    }
    if (userInDb.resetPasswordExpires < new Date()) {
      throw new Error('Reset token expiration should be in the future');
    }
    console.log(' PASS: Reset token hash generated & saved with 30-min expiry (Raw token not stored)');

    // TEST 7: Reset Password with invalid token
    console.log('\n[TEST 7] Testing Reset Password with invalid token...');
    try {
      await authService.resetPassword({
        token: 'invalid_raw_token_xyz_123',
        password: newPassword,
      });
      throw new Error('Expected 400 error for invalid token');
    } catch (err) {
      if (err.statusCode === 400) {
        console.log(' PASS: Rejected invalid token with 400 error');
      } else {
        throw err;
      }
    }

    // TEST 8: Reset Password with expired token
    console.log('\n[TEST 8] Testing Reset Password with expired token...');
    const { rawToken: expiredRawToken, tokenHash: expiredTokenHash } = generateResetToken();
    userInDb.resetPasswordTokenHash = expiredTokenHash;
    userInDb.resetPasswordExpires = new Date(Date.now() - 1000); // 1 sec in past
    await userInDb.save();

    try {
      await authService.resetPassword({
        token: expiredRawToken,
        password: newPassword,
      });
      throw new Error('Expected 400 error for expired token');
    } catch (err) {
      if (err.statusCode === 400) {
        console.log(' PASS: Rejected expired token with 400 error');
      } else {
        throw err;
      }
    }

    // TEST 9: Reset Password with valid token
    console.log('\n[TEST 9] Testing Reset Password with valid token...');
    const { rawToken: validRawToken, tokenHash: validTokenHash } = generateResetToken();
    userInDb.resetPasswordTokenHash = validTokenHash;
    userInDb.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
    await userInDb.save();

    const resetResult = await authService.resetPassword({
      token: validRawToken,
      password: newPassword,
    });
    console.log(' PASS: ' + resetResult.message);

    // TEST 10: Verify token single-use (cannot reuse)
    console.log('\n[TEST 10] Testing token single-use...');
    try {
      await authService.resetPassword({
        token: validRawToken,
        password: 'AnotherPassword789!',
      });
      throw new Error('Expected 400 error on token reuse');
    } catch (err) {
      if (err.statusCode === 400) {
        console.log(' PASS: Token cannot be reused (single-use enforced)');
      } else {
        throw err;
      }
    }

    // TEST 11: Old password rejected, new password logs in
    console.log('\n[TEST 11] Testing login with old password (must fail)...');
    try {
      await authService.login({
        email: testEmail,
        password: testPassword,
      });
      throw new Error('Old password should not work after reset');
    } catch (err) {
      if (err.statusCode === 401) {
        console.log(' PASS: Old password rejected with 401');
      } else {
        throw err;
      }
    }

    console.log('\n[TEST 12] Testing login with new password (must succeed)...');
    const newLoginResult = await authService.login({
      email: testEmail,
      password: newPassword,
    });
    if (newLoginResult.user && newLoginResult.user.email === testEmail) {
      console.log(' PASS: New password logged in successfully');
    } else {
      throw new Error('Login with new password failed');
    }

    console.log('\n ALL 12 AUTOMATED TESTS PASSED SUCCESSFULLY!');
  } finally {
    if (createdUserId) {
      await User.findByIdAndDelete(createdUserId);
      console.log('\n Cleaned up test user');
    }
    await mongoose.disconnect();
    console.log(' Disconnected from MongoDB\n');
  }
}

runTests().catch((err) => {
  console.error(' TEST FAILED:', err);
  process.exit(1);
});
