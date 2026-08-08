import mongoose from 'mongoose';
import 'dotenv/config';
import NfcCompany from './src/modules/nfc/nfcCompany.model.js';
import NfcEmployee from './src/modules/nfc/nfcEmployee.model.js';

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const companies = await NfcCompany.find().limit(2);
  console.log('Companies:', companies.map(c => ({ name: c.companyName, logo: c.logo })));
  
  const employees = await NfcEmployee.find().limit(2);
  console.log('Employees:', employees.map(e => ({ name: e.name, photo: e.photo })));
  mongoose.disconnect();
}
check().catch(console.error);
