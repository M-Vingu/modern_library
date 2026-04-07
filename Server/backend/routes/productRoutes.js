const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Product = require('../models/Product');
const Wallet = require('../models/wallet');
const protect = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// GET all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE product (admin only)
router.post('/', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// BUY product (atomic wallet debit + transaction entry)
router.post('/:id/buy', protect, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid product id' });
    }

    const productId = new mongoose.Types.ObjectId(req.params.id);
    const userId = new mongoose.Types.ObjectId(req.user.id);
    let boughtProduct;

    await session.withTransaction(async () => {
      const product = await Product.findById(productId).session(session);
      if (!product) {
        const err = new Error('Product not found');
        err.status = 404;
        throw err;
      }

      boughtProduct = product;

      const updatedWallet = await Wallet.findOneAndUpdate(
        { userId, balance: { $gte: product.price } },
        {
          $inc: { balance: -product.price },
          $push: {
            transactions: {
              type: 'payment',
              amount: product.price,
              description: `Bought ${product.name}`,
            },
          },
        },
        { returnDocument: 'after', session },
      );

      if (!updatedWallet) {
        const walletExists = await Wallet.exists({ userId }).session(session);
        if (!walletExists) {
          const err = new Error('Wallet not found');
          err.status = 404;
          throw err;
        }
        const err = new Error('Insufficient funds');
        err.status = 400;
        throw err;
      }
    });

    res.json({ message: 'Product purchased successfully', product: boughtProduct });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  } finally {
    session.endSession();
  }
});

// DELETE product
router.delete('/:id', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid product id' });
    }
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
