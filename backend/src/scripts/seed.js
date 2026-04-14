import { connectDatabase } from '../database.js';
import { seedRestaurantAndFoodData, seedAdminBootstrapData } from '../data/store.js';

try {
  await connectDatabase();
  await seedRestaurantAndFoodData();
  await seedAdminBootstrapData();
  console.log('Seed complete');
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
