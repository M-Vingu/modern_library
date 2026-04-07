const Book = require('../models/book');
const mongoose = require('mongoose');


// ==========================
// GET ALL BOOKS
// ==========================
exports.getBooks = async (req, res) => {
  try {
    const books = await Book.find().populate('borrowedBy');
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ==========================
// ADD BOOK
// ==========================
exports.addBook = async (req, res) => {
  try {
    const { title, author, copies } = req.body;

    const book = await Book.create({
      title,
      author,
      copies
    });

    res.status(201).json(book);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ==========================
// BORROW BOOK
// ==========================
exports.borrowBook = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid book id' });
    }
    const book = await Book.findById(req.params.id);

    if (!book) return res.status(404).json({ message: 'Book not found' });
    if (book.copies < 1) return res.status(400).json({ message: 'Book not available' });

    book.copies -= 1;
    await book.save();

    res.json({ message: 'Book borrowed', book });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ==========================
// RETURN BOOK
// ==========================
exports.returnBook = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid book id' });
    }
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });

    book.copies += 1;
    await book.save();

    res.json({ message: 'Book returned', book });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
