/**
 * Counter — an atomic sequence generator, used to mint sequential quotation
 * numbers (QT-0001, QT-0002, …).
 *
 * Why a dedicated collection: computing "max existing number + 1" is racy and
 * breaks when a quotation is deleted. `findByIdAndUpdate($inc)` is a single
 * atomic operation, so two simultaneous creates can never get the same number.
 */
import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: { type: String }, // the sequence name, e.g. 'quotation'
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);

/** Atomically increment and return the next value for a named sequence. */
export async function nextSequence(name) {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

export default Counter;
