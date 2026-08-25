/**
 * OfficeLocation — the geofence a Worker's self-marked attendance is checked
 * against (P2-M3). Singleton by convention: the service always reads/writes
 * the one document via `findOne()` / `findOneAndUpdate({}, …, {upsert:true})`
 * rather than an id, since there is exactly one company office today. If a
 * second site is ever needed, this becomes an array — not a redesign, just
 * dropping the singleton assumption.
 */
import mongoose from 'mongoose';

const officeLocationSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: 'Main Office' },
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    // How far (meters) a self-mark's GPS reading may be from `lat/lng` and
    // still count as "at the office". Generous by default — real-world GPS
    // accuracy is often 20-100m, worse near/inside buildings.
    radiusMeters: { type: Number, required: true, min: 10, max: 5000, default: 150 },
    // Exact public IPs that count as "on the office network" — the
    // WiFi-adjacent check. Not CIDR/subnet matching (v1 keeps this simple);
    // add range support later if a real need shows up.
    allowedIps: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('OfficeLocation', officeLocationSchema);
