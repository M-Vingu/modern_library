const Ride = require('../models/Ride');
const Wallet = require('../models/wallet');
const mongoose = require('mongoose');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function getRides(req, res) {
  try {
    const rides = await Ride.find();
    res.json(rides);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createRide(req, res) {
  try {
    const ride = await Ride.create(req.body);
    res.status(201).json(ride);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function bookRide(req, res) {
  const session = await mongoose.startSession();
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ride id' });
    }

    const rideId = new mongoose.Types.ObjectId(req.params.id);
    const userId = new mongoose.Types.ObjectId(req.user.id);
    let bookedRide;

    await session.withTransaction(async () => {
      const ride = await Ride.findById(rideId).session(session);
      if (!ride) throw httpError(404, 'Ride not found');
      if (ride.seats <= 0) throw httpError(400, 'No seats available');
      if (ride.passengers.some((id) => id.toString() === userId.toString())) {
        throw httpError(400, 'User already booked this ride');
      }

      const amount = Number(ride.price?.amount ?? 0);
      if (!Number.isFinite(amount) || amount < 0) throw httpError(400, 'Invalid ride price');

      const chargedWallet = await Wallet.findOneAndUpdate(
        { userId, balance: { $gte: amount } },
        {
          $inc: { balance: -amount },
          $push: {
            transactions: {
              type: 'payment',
              amount,
              description: `Transport booking: ${ride.from} to ${ride.to}`,
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

      bookedRide = await Ride.findOneAndUpdate(
        { _id: rideId, seats: { $gt: 0 }, passengers: { $ne: userId } },
        { $inc: { seats: -1 }, $addToSet: { passengers: userId } },
        { returnDocument: 'after', session },
      );

      if (!bookedRide) {
        throw httpError(409, 'Ride availability changed, retry booking');
      }
    });

    res.json({ message: 'Ride booked successfully', ride: bookedRide });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  } finally {
    session.endSession();
  }
}

async function deleteRide(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ride id' });
    }
    await Ride.findByIdAndDelete(req.params.id);
    res.json({ message: 'Ride deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getRides,
  createRide,
  bookRide,
  deleteRide,
};
