import dotenv from 'dotenv';
import connectDB from './db/index.js';
import { app } from './app.js';

dotenv.config({
  path: './.env',
});

/**
 * Vercel invokes this handler per request. A serverless function must not open
 * its own long-lived HTTP listener with app.listen().
 */
export default async function handler(req, res) {
  try {
    await connectDB();
    return app(req, res);
  } catch (error) {
    console.error('Unable to initialize the API function:', error);
    return res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable',
    });
  }
}

// Keep the persistent listener only for local `npm run dev` / `npm start`.
if (!process.env.VERCEL) {
  connectDB()
    .then(() => {
      app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running at port: ${process.env.PORT || 8000}`);
      });
    })
    .catch((error) => {
      console.error('MongoDB connection failed!', error);
    });
}
