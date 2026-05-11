const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Course = require('../models/Course');
const User = require('../models/user');
const Wallet = require('../models/wallet');
const protect = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { idParamOnlySchema } = require('../validations/commonSchemas');
const { courseCreateSchema } = require('../validations/courseSchemas');

// GET all courses
router.get('/', async (req, res) => {
  try {
    const courses = await Course.find();
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE course
router.post('/', protect, authorizeRoles('admin'), validateRequest(courseCreateSchema), async (req, res) => {
  try {
    const course = new Course(req.body);
    await course.save();
    res.status(201).json(course);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ENROLL in a course (atomic user + wallet update)
router.post('/:id/enroll', protect, validateRequest(idParamOnlySchema), async (req, res) => {
  const session = await mongoose.startSession();
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid course id' });
    }

    const courseId = new mongoose.Types.ObjectId(req.params.id);
    const userId = new mongoose.Types.ObjectId(req.user.id);
    let enrolledCourse;

    await session.withTransaction(async () => {
      const course = await Course.findById(courseId).session(session);
      const user = await User.findById(userId).session(session);
      if (!course) {
        const err = new Error('Course not found');
        err.status = 404;
        throw err;
      }
      if (!user) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
      }

      const alreadyEnrolled = (user.enrolledCourses || []).some(
        (id) => id.toString() === courseId.toString(),
      );
      if (alreadyEnrolled) {
        const err = new Error('Already enrolled in this course');
        err.status = 400;
        throw err;
      }

      const price = Number(course.price || 100);
      if (!Number.isFinite(price) || price < 0) {
        const err = new Error('Invalid course price');
        err.status = 400;
        throw err;
      }

      const wallet = await Wallet.findOneAndUpdate(
        { userId, balance: { $gte: price } },
        {
          $inc: { balance: -price },
          $push: {
            transactions: {
              type: 'payment',
              amount: price,
              description: `Enrolled in course: ${course.title}`,
            },
          },
        },
        { returnDocument: 'after', session },
      );

      if (!wallet) {
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

      user.enrolledCourses = user.enrolledCourses || [];
      user.enrolledCourses.push(course._id);
      await user.save({ session });
      enrolledCourse = course;
    });

    res.json({ message: 'Enrolled successfully', course: enrolledCourse });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  } finally {
    session.endSession();
  }
});

// DELETE course
router.delete('/:id', protect, authorizeRoles('admin'), validateRequest(idParamOnlySchema), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid course id' });
    }
    await Course.findByIdAndDelete(req.params.id);
    res.json({ message: 'Course deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
