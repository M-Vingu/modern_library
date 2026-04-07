const Hostel = require('../models/Hostel');
const Wallet = require('../models/wallet');
const mongoose = require('mongoose');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function getHostels(req, res) {
  try {
    const hostels = await Hostel.find();
    res.json(hostels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createHostel(req, res) {
  try {
    const hostel = await Hostel.create(req.body);
    res.status(201).json(hostel);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function bookHostel(req, res) {
  const session = await mongoose.startSession();
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid hostel id' });
    }

    const hostelId = new mongoose.Types.ObjectId(req.params.id);
    const userId = new mongoose.Types.ObjectId(req.user.id);
    let bookedHostel;

    await session.withTransaction(async () => {
      const hostel = await Hostel.findById(hostelId).session(session);
      if (!hostel) throw httpError(404, 'Hostel not found');
      if (hostel.rooms <= 0) throw httpError(400, 'No rooms available');
      if (hostel.occupants.some((id) => id.toString() === userId.toString())) {
        throw httpError(400, 'User already occupies this hostel');
      }

      const chargedWallet = await Wallet.findOneAndUpdate(
        { userId, balance: { $gte: hostel.price } },
        {
          $inc: { balance: -hostel.price },
          $push: {
            transactions: {
              type: 'payment',
              amount: hostel.price,
              description: `Booked ${hostel.name}`,
            },
          },
        },
        { returnDocument: 'after', session },
      );

      if (!chargedWallet) {
        const walletExists = await Wallet.exists({ userId }).session(session);
        if (!walletExists) throw httpError(404, 'Wallet not found');
        throw httpError(400, 'Insufficient funds');
      }

      bookedHostel = await Hostel.findOneAndUpdate(
        { _id: hostelId, rooms: { $gt: 0 }, occupants: { $ne: userId } },
        { $inc: { rooms: -1 }, $addToSet: { occupants: userId } },
        { returnDocument: 'after', session },
      );

      if (!bookedHostel) {
        throw httpError(409, 'Hostel availability changed, retry booking');
      }
    });

    res.json({ message: 'Hostel booked successfully', hostel: bookedHostel });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  } finally {
    session.endSession();
  }
}

async function deleteHostel(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid hostel id' });
    }
    await Hostel.findByIdAndDelete(req.params.id);
    res.json({ message: 'Hostel deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getHostels,
  createHostel,
  bookHostel,
  deleteHostel,
};
