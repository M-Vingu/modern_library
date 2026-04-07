const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({

  title: { type: String, required: true },
  author: { type: String, required: true },
  genre: String,

  copies: { 
    type: Number, 
    default: 1,
    min: 0
  },

  borrowedBy: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  ]

}, { timestamps: true });

module.exports = mongoose.model('Book', bookSchema);