const mongoose = require('mongoose');
const MarketplaceListing = require('../models/MarketplaceListing');
const Wallet = require('../models/wallet');
const UserReputation = require('../models/UserReputation');

function platformFeePercent() {
  const raw = Number(process.env.MARKETPLACE_FEE_PERCENT || 5);
  if (!Number.isFinite(raw) || raw < 0) return 5;
  return Math.min(raw, 30);
}

async function createListing(req, res) {
  try {
    const {
      title,
      description,
      category,
      condition,
      price,
      currency,
      imageUrls,
      quantity,
      tags,
    } = req.body;

    if (!title || price === undefined) {
      return res.status(400).json({ message: 'title and price are required' });
    }

    const listing = await MarketplaceListing.create({
      sellerId: req.user.id,
      title,
      description,
      category,
      condition,
      price: Number(price),
      currency: currency || 'KES',
      imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
      quantity: Math.max(Number(quantity) || 1, 1),
      tags: Array.isArray(tags) ? tags : [],
      status: 'active',
    });

    res.status(201).json(listing);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listListings(req, res) {
  try {
    const {
      q,
      category,
      minPrice,
      maxPrice,
      status = 'active',
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (q) filter.$text = { $search: q };
    if (category) filter.category = category;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    const safeLimit = Math.min(Number(limit) || 20, 100);
    const safePage = Math.max(Number(page) || 1, 1);

    const items = await MarketplaceListing.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate('sellerId', 'name email');

    const total = await MarketplaceListing.countDocuments(filter);
    res.json({ page: safePage, limit: safeLimit, total, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getListingById(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid listing id' });
    }

    const listing = await MarketplaceListing.findById(req.params.id).populate('sellerId', 'name email');
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function listMyListings(req, res) {
  try {
    const items = await MarketplaceListing.find({ sellerId: req.user.id }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateMyListing(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid listing id' });
    }

    const allowed = [
      'title',
      'description',
      'category',
      'condition',
      'price',
      'currency',
      'imageUrls',
      'status',
      'quantity',
      'tags',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.price !== undefined) updates.price = Number(updates.price);
    if (updates.quantity !== undefined) updates.quantity = Math.max(Number(updates.quantity) || 1, 1);

    const listing = await MarketplaceListing.findOneAndUpdate(
      { _id: req.params.id, sellerId: req.user.id },
      updates,
      { returnDocument: 'after' },
    );
    if (!listing) return res.status(404).json({ message: 'Listing not found or not owned by user' });

    res.json(listing);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function buyListing(req, res) {
  const session = await mongoose.startSession();
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid listing id' });
    }

    const listingId = new mongoose.Types.ObjectId(req.params.id);
    const buyerId = new mongoose.Types.ObjectId(req.user.id);
    const feePercent = platformFeePercent();

    let listingDoc;
    await session.withTransaction(async () => {
      const listing = await MarketplaceListing.findById(listingId).session(session);
      if (!listing) {
        const err = new Error('Listing not found');
        err.status = 404;
        throw err;
      }
      if (listing.status !== 'active') {
        const err = new Error('Listing is not available');
        err.status = 400;
        throw err;
      }
      if (listing.sellerId.toString() === buyerId.toString()) {
        const err = new Error('Seller cannot buy own listing');
        err.status = 400;
        throw err;
      }

      const amount = Number(listing.price);
      const platformFee = Number((amount * feePercent / 100).toFixed(2));
      const sellerPayout = Number((amount - platformFee).toFixed(2));

      const buyerWallet = await Wallet.findOneAndUpdate(
        { userId: buyerId, balance: { $gte: amount } },
        {
          $inc: { balance: -amount },
          $push: {
            transactions: {
              type: 'payment',
              amount,
              description: `Marketplace purchase: ${listing.title}`,
            },
          },
        },
        { returnDocument: 'after', session },
      );

      if (!buyerWallet) {
        const walletExists = await Wallet.exists({ userId: buyerId }).session(session);
        const err = new Error(walletExists ? 'Insufficient funds' : 'Buyer wallet not found');
        err.status = walletExists ? 400 : 404;
        throw err;
      }

      const sellerWallet = await Wallet.findOneAndUpdate(
        { userId: listing.sellerId },
        {
          $inc: { balance: sellerPayout },
          $push: {
            transactions: {
              type: 'reward',
              amount: sellerPayout,
              description: `Marketplace sale payout: ${listing.title}`,
            },
          },
        },
        { returnDocument: 'after', session },
      );

      if (!sellerWallet) {
        const err = new Error('Seller wallet not found');
        err.status = 404;
        throw err;
      }

      listingDoc = await MarketplaceListing.findOneAndUpdate(
        { _id: listingId, status: 'active' },
        { status: 'sold', buyerId, soldAt: new Date() },
        { returnDocument: 'after', session },
      );

      if (!listingDoc) {
        const err = new Error('Listing changed during purchase');
        err.status = 409;
        throw err;
      }

      await UserReputation.findOneAndUpdate(
        { userId: listing.sellerId },
        { $inc: { completedSales: 1 }, $setOnInsert: { userId: listing.sellerId, sellerScore: 5 } },
        { upsert: true, session },
      );
    });

    res.json({
      message: 'Purchase successful',
      listing: listingDoc,
      platformFeePercent: feePercent,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  } finally {
    session.endSession();
  }
}

module.exports = {
  createListing,
  listListings,
  getListingById,
  listMyListings,
  updateMyListing,
  buyListing,
};
