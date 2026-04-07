require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/user');
const Wallet = require('./models/wallet');
const Transaction = require('./models/transaction');
const Book = require('./models/book');
const Course = require('./models/Course');
const Product = require('./models/Product');
const Ride = require('./models/Ride');
const Hostel = require('./models/Hostel');

async function connectDb() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/modernLibrary';
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
}

async function clearCollections() {
  await Promise.all([
    User.deleteMany({}),
    Wallet.deleteMany({}),
    Transaction.deleteMany({}),
    Book.deleteMany({}),
    Course.deleteMany({}),
    Product.deleteMany({}),
    Ride.deleteMany({}),
    Hostel.deleteMany({}),
  ]);
}

async function seedData() {
  try {
    await connectDb();
    console.log('Connected to MongoDB for seeding');

    await clearCollections();

    const courses = await Course.insertMany([
      {
        title: 'Java Programming',
        description: 'Learn Java from beginner to advanced',
        instructor: 'Dr. Smith',
        price: { amount: 1200, currency: 'KES' },
      },
      {
        title: 'Web Development',
        description: 'HTML, CSS, JavaScript and React',
        instructor: 'Prof. Linda',
        price: { amount: 1500, currency: 'KES' },
      },
      {
        title: 'Database Systems',
        description: 'Learn SQL and MongoDB',
        instructor: 'Dr. Ahmed',
        price: { amount: 1000, currency: 'KES' },
      },
    ]);

    const products = await Product.insertMany([
      {
        name: 'Laptop HP Elitebook',
        price: { amount: 450, currency: 'KES' },
        seller: 'James',
        stock: 5,
      },
      {
        name: 'Engineering Calculator',
        price: { amount: 30, currency: 'KES' },
        seller: 'Mary',
        stock: 30,
      },
      {
        name: 'Programming Books',
        price: { amount: 20, currency: 'KES' },
        seller: 'Kelvin',
        stock: 40,
      },
    ]);

    const rides = await Ride.insertMany([
      {
        from: 'Campus',
        to: 'Town',
        driver: 'Peter',
        seats: 3,
        price: { amount: 150, currency: 'KES' },
      },
      {
        from: 'Campus',
        to: 'Hostels',
        driver: 'John',
        seats: 4,
        price: { amount: 80, currency: 'KES' },
      },
    ]);

    const hostels = await Hostel.insertMany([
      { name: 'Sunrise Hostel', rooms: 10, price: 120 },
      { name: 'Green Park Hostel', rooms: 8, price: 100 },
    ]);

    const books = await Book.insertMany([
      { title: 'Atomic Habits', author: 'James Clear', copies: 3 },
      { title: 'Clean Code', author: 'Robert C. Martin', copies: 2 },
      { title: 'Effective Java', author: 'Joshua Bloch', copies: 2 },
    ]);

    const usersData = [
      { name: 'Alice', email: 'alice@example.com', password: 'password123' },
      { name: 'Bob', email: 'bob@example.com', password: 'password123' },
      { name: 'Charlie', email: 'charlie@example.com', password: 'password123' },
    ];

    const users = [];

    for (const u of usersData) {
      const hashedPassword = await bcrypt.hash(u.password, 10);
      const user = new User({
        name: u.name,
        email: u.email.toLowerCase(),
        password: hashedPassword,
        borrowedBooks: [],
        currency: 'KES',
        locale: 'en-US',
        role: 'user',
        referralCode: Math.random().toString(36).slice(2, 8),
      });
      await user.save();

      const wallet = new Wallet({
        userId: user._id,
        balance: Math.floor(Math.random() * 1000),
        currency: 'KES',
        transactions: [],
      });
      await wallet.save();

      user.wallet = wallet._id;
      await user.save();

      users.push({ user, wallet });
    }

    const alice = users[0];
    await Transaction.create({
      userId: alice.user._id,
      walletId: alice.wallet._id,
      type: 'reward',
      amount: 50,
      bookId: books[0]._id,
    });

    await Wallet.findByIdAndUpdate(
      alice.wallet._id,
      {
        $inc: { balance: 50 },
        $push: {
          transactions: {
            type: 'reward',
            amount: 50,
            description: 'Welcome reward',
          },
        },
      },
      { returnDocument: 'after' },
    );

    users[0].user.borrowedBooks.push(books[0]._id);
    users[1].user.borrowedBooks.push(books[1]._id);
    await users[0].user.save();
    await users[1].user.save();

    console.log('Database seeded successfully');
    console.log(`Courses: ${courses.length}, Products: ${products.length}, Rides: ${rides.length}, Hostels: ${hostels.length}, Books: ${books.length}`);
  } catch (err) {
    console.error('Seeding error:', err.message);
  } finally {
    await mongoose.connection.close();
  }
}

seedData();
