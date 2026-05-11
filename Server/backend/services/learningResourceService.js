const mongoose = require('mongoose');
const Book = require('../models/book');
const Course = require('../models/Course');
const PastPaper = require('../models/PastPaper');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSelection(selection) {
  return {
    resourceType: selection.resourceType,
    resourceId: String(selection.resourceId || '').trim(),
  };
}

async function fetchResourcesForTutor({ q = '', limit = 10 }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 20);
  const regex = q ? new RegExp(escapeRegex(String(q).trim()), 'i') : null;

  const [books, courses, pastPapers] = await Promise.all([
    Book.find(regex ? { $or: [{ title: regex }, { author: regex }, { genre: regex }] } : {})
      .limit(safeLimit)
      .select('title author genre copies createdAt')
      .lean(),
    Course.find(regex ? { $or: [{ title: regex }, { description: regex }, { instructor: regex }] } : {})
      .limit(safeLimit)
      .select('title description instructor price createdAt')
      .lean(),
    PastPaper.find(regex ? {
      visibility: 'public',
      $or: [{ title: regex }, { institution: regex }, { course: regex }, { subject: regex }],
    } : { visibility: 'public' })
      .limit(safeLimit)
      .select('title institution course subject year isVerified createdAt')
      .lean(),
  ]);

  return {
    books: books.map((item) => ({
      resourceType: 'book',
      resourceId: item._id.toString(),
      title: item.title,
      summary: [item.author, item.genre].filter(Boolean).join(' | '),
      availableCopies: item.copies,
    })),
    courses: courses.map((item) => ({
      resourceType: 'course',
      resourceId: item._id.toString(),
      title: item.title,
      summary: [item.instructor, item.description].filter(Boolean).join(' | ').slice(0, 180),
      price: item.price,
    })),
    pastPapers: pastPapers.map((item) => ({
      resourceType: 'past_paper',
      resourceId: item._id.toString(),
      title: item.title,
      summary: [item.course, item.subject, item.year].filter(Boolean).join(' | '),
      verified: item.isVerified,
    })),
  };
}

async function resolveSelectedResources(selections = []) {
  const normalized = (Array.isArray(selections) ? selections : []).map(normalizeSelection);
  const buckets = {
    book: [],
    course: [],
    past_paper: [],
  };

  for (const item of normalized) {
    if (!mongoose.Types.ObjectId.isValid(item.resourceId)) continue;
    if (buckets[item.resourceType]) buckets[item.resourceType].push(item.resourceId);
  }

  const [books, courses, pastPapers] = await Promise.all([
    buckets.book.length
      ? Book.find({ _id: { $in: buckets.book } }).select('title author genre copies').lean()
      : [],
    buckets.course.length
      ? Course.find({ _id: { $in: buckets.course } }).select('title description instructor price').lean()
      : [],
    buckets.past_paper.length
      ? PastPaper.find({ _id: { $in: buckets.past_paper }, visibility: 'public' })
        .select('title institution course subject year isVerified')
        .lean()
      : [],
  ]);

  return {
    books: books.map((item) => ({
      id: item._id.toString(),
      type: 'book',
      title: item.title,
      summary: [item.author, item.genre].filter(Boolean).join(' | ') || 'Library book',
      availableCopies: item.copies,
    })),
    courses: courses.map((item) => ({
      id: item._id.toString(),
      type: 'course',
      title: item.title,
      summary: [
        item.instructor ? `Instructor: ${item.instructor}` : null,
        item.description,
      ].filter(Boolean).join(' | ').slice(0, 200) || 'Course',
    })),
    pastPapers: pastPapers.map((item) => ({
      id: item._id.toString(),
      type: 'past_paper',
      title: item.title,
      summary: [item.course, item.subject, item.year].filter(Boolean).join(' | ') || 'Past paper',
      verified: Boolean(item.isVerified),
      year: item.year,
    })),
    linkedResources: [
      ...books.map((item) => ({ resourceType: 'book', resourceId: item._id.toString(), label: item.title })),
      ...courses.map((item) => ({ resourceType: 'course', resourceId: item._id.toString(), label: item.title })),
      ...pastPapers.map((item) => ({ resourceType: 'past_paper', resourceId: item._id.toString(), label: item.title })),
    ],
  };
}

module.exports = {
  fetchResourcesForTutor,
  resolveSelectedResources,
};
