import app from './app.js';
import { config } from './config.js';
import { connectDatabase } from './database.js';

await connectDatabase();

app.listen(config.port, () => {
  console.log('FDP backend listening on http://localhost:' + config.port);
});
