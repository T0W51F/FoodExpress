import { Router } from 'express';
import {
  createOrder,
  deleteOrderById,
  getCart,
  getOrderById,
  listOrders,
  saveCart,
  validatePromoCode
} from '../data/store.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/promotions/validate/', async (req, res, next) => {
  try {
    const result = await validatePromoCode(req.body.code, req.body.subtotal);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/cart/', requireAuth, async (req, res, next) => {
  try {
    res.json(await getCart(req.user.user_id));
  } catch (error) {
    next(error);
  }
});

router.post('/cart/', requireAuth, async (req, res, next) => {
  try {
    res.json(await saveCart(req.user.user_id, req.body));
  } catch (error) {
    next(error);
  }
});

router.get('/orders/', requireAuth, async (req, res, next) => {
  try {
    res.json(await listOrders(req.user.user_id));
  } catch (error) {
    next(error);
  }
});

router.post('/orders/', requireAuth, async (req, res, next) => {
  try {
    res.status(201).json(await createOrder(req.user.user_id, req.body));
  } catch (error) {
    next(error);
  }
});

router.get('/orders/:id/', requireAuth, async (req, res, next) => {
  try {
    res.json(await getOrderById(req.user.user_id, req.params.id));
  } catch (error) {
    next(error);
  }
});

router.delete('/orders/:id/', requireAuth, async (req, res, next) => {
  try {
    await deleteOrderById(req.user.user_id, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
