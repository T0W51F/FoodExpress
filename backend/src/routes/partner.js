import { Router } from 'express';
import { submitPartnerApplication, getApplicationByEmail } from '../data/store.js';

const router = Router();

// POST /api/partner/apply — public, submit a partner application
router.post('/apply', async (req, res, next) => {
  try {
    const app = await submitPartnerApplication(req.body);
    res.status(201).json(app);
  } catch (error) {
    next(error);
  }
});

// GET /api/partner/status/:email — public, check application status by email
router.get('/status/:email', async (req, res, next) => {
  try {
    const app = await getApplicationByEmail(req.params.email);
    // Return only the public-safe fields (no internal IDs)
    res.json({
      business_name: app.business_name,
      status: app.status,
      rejection_reason: app.rejection_reason || '',
      submitted_at: app.created_at
    });
  } catch (error) {
    next(error);
  }
});

export default router;
