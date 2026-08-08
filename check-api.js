import 'dotenv/config';
import mongoose from 'mongoose';
import { getPublicCardByToken } from './src/modules/nfc/nfc.service.js';

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const data = await getPublicCardByToken('rFkmKd71vMd8');
  console.log('Public Data:', JSON.stringify(data, null, 2));
  mongoose.disconnect();
}
check().catch(console.error);
