import { UserModel } from '../models/user.model.js';
import { verifyFirebaseToken } from '../middlewares/auth-verify.middleware.js'; 

export const userSignupController = async (req, res) => {
  try {
    const {
      uid,
      email,
      displayName,
      photoURL,
      providerId,
      createdAt,
      lastLoginAt,
      providerData,
      tokens,
    } = req.body;

    const user = await UserModel.findOneAndUpdate(
      { email },
      { uid, displayName, photoURL, providerId, createdAt, lastLoginAt, providerData, tokens },
      { new: true, upsert: true }
    );

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUserController = async (req, res) => {
  try {
    const email = req.user.email; 

    const user = await UserModel.findOne({ email });

    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

      res.json(user);
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
  }
}

export const updateUserController = async (req, res) => {
  try {
    const { email, gender, country, address } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required' });
    const userDoc = await UserModel.findOne({ email });
    if (!userDoc) return res.status(404).json({ error: 'User not found' });
    
    const updated = await UserModel.findOneAndUpdate(
      { email },
      { gender, country, address },
      { new: true, upsert: true }
    );

    res.status(200).json({ message: 'Profile updated successfully', data: updated });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const updateUserCookieController = async (req, res) => {
  try {
    const { email, cookieAcknowledged } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required' });
    const userDoc = await UserModel.findOne({
      email,
    });
    if (!userDoc) return res.status(404).json({ error: 'User not found' });
    const updated = await UserModel.findOneAndUpdate(
      { email },
      { cookieAcknowledged },
      { new: true, upsert: true }
    );
    res.status(200).json({ message: 'Cookie updated successfully', data: updated });
  } catch (error) {
    console.error('Error updating user cookie:', error);
    res.status(500).json({ error: 'Failed to update cookie' });
  }
}
