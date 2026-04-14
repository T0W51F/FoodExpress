import { AuditLog, Category, Counter, DeliveryPerson, Food, GlobalPromotion, PartnerApplication, Promotion, Restaurant, Review, User } from '../models/index.js';

const sequenceSources = {
  users: { Model: User, field: 'user_id' },
  reviews: { Model: Review, field: 'review_id' },
  foods: { Model: Food, field: 'food_id' },
  restaurants: { Model: Restaurant, field: 'restaurant_id' },
  delivery_people: { Model: DeliveryPerson, field: 'delivery_person_id' },
  promotions: { Model: Promotion, field: 'promotion_id' },
  applications: { Model: PartnerApplication, field: 'application_id' },
  audit_logs:   { Model: AuditLog, field: 'log_id' },
  global_promos: { Model: GlobalPromotion, field: 'promo_id' },
  categories: { Model: Category, field: 'category_id' }
};

async function getCurrentMaxValue(key) {
  const source = sequenceSources[key];
  if (!source) {
    return 0;
  }

  const latest = await source.Model.findOne().sort({ [source.field]: -1 }).select({ [source.field]: 1, _id: 0 }).lean();
  return Number(latest?.[source.field] || 0);
}

export async function getNextSequence(key) {
  // Step 1: Ensure the counter floor is at least as high as the max
  // existing document ID. Uses $max so this is idempotent and safe to
  // run concurrently — $max only ever raises the stored value, never
  // lowers it. upsert:true creates the counter at currentMax if absent.
  const currentMax = await getCurrentMaxValue(key);
  await Counter.findOneAndUpdate(
    { key },
    { $max: { value: currentMax } },
    { upsert: true }
  );

  // Step 2: Atomically increment and return. A single findOneAndUpdate
  // with $inc is the standard MongoDB pattern for sequence generation —
  // each caller gets a unique, strictly increasing value with no TOCTOU
  // window between read and write.
  const updated = await Counter.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    { new: true }
  );

  return updated.value;
}
