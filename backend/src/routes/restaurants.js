import { Router } from 'express';
import {
  addReview,
  getFoodById,
  getFoodsByRestaurantId,
  getRestaurantById,
  listFeaturedRestaurants,
  listFoods,
  listRestaurants,
  searchRestaurants,
  listActiveCategories
} from '../data/store.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/restaurants/featured/', async (_req, res, next) => {
  try {
    res.json(await listFeaturedRestaurants());
  } catch (error) {
    next(error);
  }
});

router.get('/restaurants/', async (req, res, next) => {
  try {
    res.json(await listRestaurants(req.query));
  } catch (error) {
    next(error);
  }
});

router.get('/restaurants/:id/', async (req, res, next) => {
  try {
    res.json(await getRestaurantById(req.params.id));
  } catch (error) {
    next(error);
  }
});

router.get('/restaurants/:id/foods/', async (req, res, next) => {
  try {
    res.json(await getFoodsByRestaurantId(req.params.id));
  } catch (error) {
    next(error);
  }
});

router.get('/foods/', async (req, res, next) => {
  try {
    res.json(await listFoods(req.query));
  } catch (error) {
    next(error);
  }
});

router.get('/foods/:id/', async (req, res, next) => {
  try {
    res.json(await getFoodById(req.params.id));
  } catch (error) {
    next(error);
  }
});

router.get('/search/', async (req, res, next) => {
  try {
    res.json(await searchRestaurants(req.query.q || ''));
  } catch (error) {
    next(error);
  }
});

router.post('/reviews/', requireAuth, async (req, res, next) => {
  try {
    res.status(201).json(await addReview({ ...req.body, user_id: req.user.user_id }));
  } catch (error) {
    next(error);
  }
});

// Public: active categories only (used by partner dashboard food form)
router.get('/categories/', async (_req, res, next) => {
  try {
    res.json(await listActiveCategories());
  } catch (error) {
    next(error);
  }
});

export default router;
