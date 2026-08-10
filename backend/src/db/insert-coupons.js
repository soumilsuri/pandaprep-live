import mongoose from 'mongoose';
import { CouponModel } from "../models/coupon.model.js";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, '../../.env'), 
});

// Database connection function
const connectDB = async () => { 
  try {
    const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}`);
    console.log(`MongoDB connected!! DB HOST: ${connectionInstance.connection.host}`);
  } catch (error) {
    console.error("MONGODB connection FAILED", error);
    process.exit(1);
  }
};

// Sample coupons
const sampleCoupons = [
  {
    code: "TESTDEV",
    discount_type: "percentage",
    discount_value: 10,
    validity: {
      start_date: new Date("2024-01-01"),
      end_date: new Date("2025-12-31")
    },
    usage_limit: 100,
    used_count: 0,
    is_active: true
  },
  {
    code: "SAVE20",
    discount_type: "percentage",
    discount_value: 20,
    validity: {
      start_date: new Date("2024-06-01"),
      end_date: new Date("2025-06-30")
    },
    usage_limit: 50,
    used_count: 0,
    is_active: true
  },
  {
    code: "FLAT50",
    discount_type: "flat",
    discount_value: 50,
    validity: {
      start_date: new Date("2024-01-01"),
      end_date: new Date("2025-12-31")
    },
    usage_limit: 200,
    used_count: 0,
    is_active: true
  }
];

// Insert coupons
async function insertCoupons() {
  try {
    await connectDB();  // Connect to MongoDB

    // Optional: clear existing coupons
    // await CouponModel.deleteMany({});

    const result = await CouponModel.insertMany(sampleCoupons);
    console.log(` ${result.length} coupons inserted:`, result.map(c => c.code).join(", "));
    
    process.exit(0);
  } catch (error) {
    console.error('Error inserting coupons:', error);
    process.exit(1);
  }
}

insertCoupons();
