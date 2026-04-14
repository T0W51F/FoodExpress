import { Router } from 'express';
import {
  authenticateUser,
  buildAuthPayload,
  createUser,
  refreshAccessToken,
  revokeRefreshToken,
  updateUserProfile
} from '../data/store.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register/', async (req, res, next) => {
  try {
    const user = await createUser(req.body);
    res.status(201).json({
      ...(await buildAuthPayload(user)),
      message: 'User registered successfully. Please verify your email.'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login/', async (req, res, next) => {
  try {
    const user = await authenticateUser(req.body.email, req.body.password);
    res.json({
      ...(await buildAuthPayload(user)),
      message: 'Login successful'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login/refresh/', async (req, res, next) => {
  try {
    res.json(await refreshAccessToken(req.body.refresh));
  } catch (error) {
    next(error);
  }
});

router.post('/token/refresh/', async (req, res, next) => {
  try {
    res.json(await refreshAccessToken(req.body.refresh));
  } catch (error) {
    next(error);
  }
});

router.post('/logout/', requireAuth, async (req, res, next) => {
  try {
    if (req.body.refresh) {
      await revokeRefreshToken(req.body.refresh);
    }
    res.status(205).json({ message: 'Logout successful' });
  } catch (error) {
    next(error);
  }
});

router.get('/profile/', requireAuth, (req, res) => {
  res.json({
    id: req.user.user_id,
    first_name: req.user.first_name,
    last_name: req.user.last_name,
    email: req.user.email,
    phone: req.user.phone,
    role: req.user.role,
    status: req.user.status
  });
});

router.put('/profile/update/', requireAuth, async (req, res, next) => {
  try {
    const profile = await updateUserProfile(req.user.user_id, req.body);
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

export default router;
