const Book = require('../models/book');
const Course = require('../models/Course');
const PastPaper = require('../models/PastPaper');
const { extractOutputText } = require('./openAiJsonService');
const {
  getConfiguredAiProvider,
  getConfiguredOpenAiModel,
  getConfiguredPromptVersion,
  getDefaultFallbackModel,
} = require('./aiRuntimeConfig');

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'be', 'can', 'do', 'for', 'help', 'how', 'i', 'in',
  'is', 'learn', 'me', 'my', 'of', 'on', 'please', 'show', 'study', 'teach',
  'the', 'this', 'to', 'understand', 'with',
]);

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function extractSearchTerms(message, context, history = []) {
  const previousMessages = Array.isArray(history)
    ? history
      .filter((entry) => entry && entry.role === 'user')
      .slice(-4)
      .map((entry) => entry.content)
    : [];

  const raw = [
    ...previousMessages,
    message,
    context?.subject,
    context?.topic,
    context?.course,
    context?.institution,
    Array.isArray(context?.keywords) ? context.keywords.join(' ') : '',
  ]
    .map((value) => normalizeWhitespace(value).toLowerCase())
    .filter(Boolean)
    .join(' ');

  const uniqueTerms = [];
  for (const part of raw.split(/[^a-z0-9]+/i)) {
    if (!part || part.length < 3 || STOP_WORDS.has(part)) continue;
    if (!uniqueTerms.includes(part)) uniqueTerms.push(part);
  }

  return uniqueTerms.slice(0, 8);
}

function buildRegex(terms) {
  if (!terms.length) return null;
  return new RegExp(terms.map(escapeRegex).join('|'), 'i');
}

function scoreText(text, terms, weight = 1) {
  const haystack = String(text || '').toLowerCase();
  if (!haystack) return 0;

  return terms.reduce((total, term) => {
    if (haystack === term) return total + (3 * weight);
    if (haystack.includes(term)) return total + weight;
    return total;
  }, 0);
}

function buildBookSummary(item) {
  const parts = [item.author, item.genre].filter(Boolean);
  return parts.length ? parts.join(' | ') : 'Library book';
}

function buildCourseSummary(item) {
  const parts = [];
  if (item.instructor) parts.push(`Instructor: ${item.instructor}`);
  if (item.price?.amount != null) {
    parts.push(`Price: ${item.price.amount} ${item.price.currency || 'KES'}`);
  }
  return parts.join(' | ') || 'Course';
}

function buildPastPaperSummary(item) {
  const parts = [item.course, item.subject, item.year].filter(Boolean);
  return parts.join(' | ') || 'Past paper';
}

function rankBooks(items, terms) {
  return items
    .map((item) => ({
      id: item._id?.toString?.() || null,
      type: 'book',
      title: item.title,
      summary: buildBookSummary(item),
      availableCopies: item.copies,
      score: (
        scoreText(item.title, terms, 4)
        + scoreText(item.author, terms, 2)
        + scoreText(item.genre, terms, 2)
      ),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || (b.availableCopies || 0) - (a.availableCopies || 0))
    .slice(0, 3);
}

function rankCourses(items, terms) {
  return items
    .map((item) => ({
      id: item._id?.toString?.() || null,
      type: 'course',
      title: item.title,
      summary: buildCourseSummary(item),
      score: (
        scoreText(item.title, terms, 4)
        + scoreText(item.description, terms, 2)
        + scoreText(item.instructor, terms, 1)
      ),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function rankPastPapers(items, terms) {
  return items
    .map((item) => ({
      id: item._id?.toString?.() || null,
      type: 'past_paper',
      title: item.title,
      summary: buildPastPaperSummary(item),
      verified: Boolean(item.isVerified),
      year: item.year,
      score: (
        scoreText(item.title, terms, 4)
        + scoreText(item.subject, terms, 3)
        + scoreText(item.course, terms, 3)
        + scoreText(item.institution, terms, 1)
        + scoreText(Array.isArray(item.tags) ? item.tags.join(' ') : '', terms, 2)
      ),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || (b.verified === true) - (a.verified === true) || (b.year || 0) - (a.year || 0))
    .slice(0, 3);
}

async function fetchResourceMatches(terms) {
  const regex = buildRegex(terms);
  if (!regex) {
    return { books: [], courses: [], pastPapers: [] };
  }

  const [books, courses, pastPapers] = await Promise.all([
    Book.find({
      $or: [{ title: regex }, { author: regex }, { genre: regex }],
    }).limit(12).lean(),
    Course.find({
      $or: [{ title: regex }, { description: regex }, { instructor: regex }],
    }).limit(12).lean(),
    PastPaper.find({
      visibility: 'public',
      $or: [
        { title: regex },
        { institution: regex },
        { course: regex },
        { unitCode: regex },
        { subject: regex },
        { tags: regex },
      ],
    }).limit(12).lean(),
  ]);

  return {
    books: rankBooks(books, terms),
    courses: rankCourses(courses, terms),
    pastPapers: rankPastPapers(pastPapers, terms),
  };
}

function mergeResourceMatches(primary, secondary) {
  const mergeGroup = (first = [], second = []) => {
    const items = [...first, ...second];
    const seen = new Set();
    return items.filter((item) => {
      const key = `${item.type}:${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5);
  };

  return {
    books: mergeGroup(primary?.books, secondary?.books),
    courses: mergeGroup(primary?.courses, secondary?.courses),
    pastPapers: mergeGroup(primary?.pastPapers, secondary?.pastPapers),
  };
}

function buildFallbackReply(message, context) {
  const subject = context?.subject || context?.topic || 'general studies';
  const tone = context?.tone || 'supportive';

  return {
    reply: `I can help you with ${subject}. A strong next step is to break "${message}" into smaller concepts, do timed practice, and review the mistakes that repeat most often.`,
    guidance: [
      'Create one focused 45-minute study block around the hardest subtopic first.',
      'Attempt one question from memory before checking notes or a solution.',
      'Write down the exact mistake pattern you want to avoid in the next attempt.',
    ],
    tone,
    grounded: false,
    resources: {
      books: [],
      courses: [],
      pastPapers: [],
    },
  };
}

function buildGroundedReply(message, context, resources) {
  const tone = context?.tone || 'supportive';
  const subject = context?.subject || context?.topic || 'your topic';
  const topCourse = resources.courses[0];
  const topBook = resources.books[0];
  const topPaper = resources.pastPapers[0];

  const openings = [];
  if (topCourse) openings.push(`start with the course "${topCourse.title}"`);
  if (topBook) openings.push(`use the book "${topBook.title}" for concept review`);
  if (topPaper) openings.push(`practice with "${topPaper.title}"`);

  const reply = openings.length
    ? `For ${subject}, I'd anchor your work around ${openings.join(', ')}. That gives you a path from explanation to practice for "${message}".`
    : `I found related Modern Library resources for ${subject}. Use them to move from concept review into exam-style practice for "${message}".`;

  const guidance = [
    topCourse
      ? `Study the key idea from "${topCourse.title}" first, then summarize it in your own words.`
      : 'Write a short outline of the concept before attempting questions.',
    topBook
      ? `Pull examples or definitions from "${topBook.title}" and turn them into quick recall notes.`
      : 'Turn your notes into three recall questions and answer them without looking.',
    topPaper
      ? `Use "${topPaper.title}" as a timed practice checkpoint after revision.`
      : 'Finish with one timed practice question to test whether the concept is sticking.',
  ];

  return {
    reply,
    guidance,
    tone,
    grounded: true,
    resources,
  };
}

function buildResourceContext(resources) {
  const lines = [];
  for (const book of resources.books || []) {
    lines.push(`Book: ${book.title} | ${book.summary}`);
  }
  for (const course of resources.courses || []) {
    lines.push(`Course: ${course.title} | ${course.summary}`);
  }
  for (const paper of resources.pastPapers || []) {
    lines.push(`Past paper: ${paper.title} | ${paper.summary}`);
  }
  return lines.length ? lines.join('\n') : 'No matching internal resources were found.';
}

function buildOpenAiInput({ message, context, history, resources }) {
  const compactHistory = Array.isArray(history) ? history.slice(-12) : [];
  const conversationTurns = compactHistory.map((entry) => ({
    role: entry.role === 'assistant' ? 'assistant' : 'user',
    content: normalizeWhitespace(entry.content),
  }));

  const subject = context?.subject || context?.topic || 'general studies';
  const tone = context?.tone || 'supportive';
  const resourceContext = buildResourceContext(resources);
  const promptVersion = context?.promptVersion || 'ai-tutor-rag-v2';

  return [
    {
      role: 'system',
      content: [
        'You are the Modern Library AI Tutor.',
        `Prompt version: ${promptVersion}.`,
        'Use the conversation history and retrieved Modern Library resources to answer naturally and clearly.',
        'If resources are relevant, mention them explicitly.',
        'Return valid JSON only with keys: reply, guidance, tone, grounded.',
        'guidance must be an array of 3 concise study actions.',
        `Default tone: ${tone}.`,
      ].join(' '),
    },
    {
      role: 'user',
      content: [
        `Subject: ${subject}`,
        `Context JSON: ${JSON.stringify(context || {})}`,
        'Retrieved resources:',
        resourceContext,
        'Conversation history:',
        JSON.stringify(conversationTurns),
        `Current user message: ${message}`,
      ].join('\n'),
    },
  ];
}

function normalizeOpenAiPayload(parsed, fallbackTone) {
  const guidance = Array.isArray(parsed?.guidance)
    ? parsed.guidance.map((item) => normalizeWhitespace(item)).filter(Boolean).slice(0, 3)
    : [];

  if (!normalizeWhitespace(parsed?.reply) || guidance.length === 0) {
    throw new Error('OpenAI response missing required tutor fields');
  }

  return {
    reply: normalizeWhitespace(parsed.reply),
    guidance,
    tone: normalizeWhitespace(parsed.tone) || fallbackTone || 'supportive',
    grounded: parsed.grounded !== false,
  };
}

function normalizeTokenUsage(usage) {
  if (!usage || typeof usage !== 'object') {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  }

  return {
    inputTokens: Number(usage.input_tokens || usage.inputTokens || 0),
    outputTokens: Number(usage.output_tokens || usage.outputTokens || 0),
    totalTokens: Number(usage.total_tokens || usage.totalTokens || 0),
  };
}

async function generateOpenAiReply({ message, context, history, resources, promptVersion }) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const baseUrl = String(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const timeoutMs = Number(process.env.OPENAI_API_TIMEOUT_MS || 15000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: getConfiguredOpenAiModel(),
        input: buildOpenAiInput({
          message,
          context: { ...context, promptVersion },
          history,
          resources,
        }),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errorText.slice(0, 300)}`);
    }

    const payload = await response.json();
    const outputText = extractOutputText(payload);
    if (!outputText) throw new Error('OpenAI API returned empty output');

    const parsed = JSON.parse(outputText);
    return {
      ...normalizeOpenAiPayload(parsed, context?.tone),
      tokenUsage: normalizeTokenUsage(payload.usage),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function generateChatReply({
  message,
  context = {},
  user,
  sessionId = null,
  history = [],
  resourceMatchesOverride = null,
  endpoint = 'ai.chat',
  requestId = null,
  promptVersion,
}) {
  const startedAt = Date.now();
  const safeHistory = Array.isArray(history) ? history.filter((entry) => entry && entry.content) : [];
  const safeContext = context && typeof context === 'object' ? context : {};
  const safeMessage = normalizeWhitespace(message);
  const resolvedPromptVersion = getConfiguredPromptVersion({
    endpoint,
    requestedPromptVersion: promptVersion || safeContext.promptVersion,
  });
  const fallbackModel = getDefaultFallbackModel();

  const buildMeta = ({
    provider,
    searchTerms = [],
    resourceMatches = { books: [], courses: [], pastPapers: [] },
    tokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    success = true,
    note,
    fallbackUsed = false,
  }) => ({
    userId: user?.id || null,
    requestId,
    endpoint,
    model: provider === 'openai' ? getConfiguredOpenAiModel() : fallbackModel,
    promptVersion: resolvedPromptVersion,
    searchTerms,
    resourceCounts: {
      books: resourceMatches.books.length,
      courses: resourceMatches.courses.length,
      pastPapers: resourceMatches.pastPapers.length,
    },
    responseTimeMs: Date.now() - startedAt,
    tokenUsage,
    success,
    fallbackUsed,
    messageCount: safeHistory.length,
    note,
  });

  if (!safeMessage) {
    return {
      provider: 'mock',
      ...buildFallbackReply('your topic', safeContext),
      sessionId,
      history: safeHistory,
      meta: buildMeta({
        provider: 'mock',
        note: 'Message was empty. Returning scaffold guidance.',
      }),
    };
  }

  try {
    const searchTerms = extractSearchTerms(safeMessage, safeContext, safeHistory);
    let resourceMatches = resourceMatchesOverride || { books: [], courses: [], pastPapers: [] };
    let lookupError = null;
    let providerError = null;

    if (!resourceMatchesOverride) {
      try {
        resourceMatches = await fetchResourceMatches(searchTerms);
      } catch (err) {
        lookupError = err;
      }
    } else {
      try {
        const discoveredMatches = await fetchResourceMatches(searchTerms);
        resourceMatches = mergeResourceMatches(resourceMatchesOverride, discoveredMatches);
      } catch (err) {
        lookupError = err;
      }
    }

    const hasMatches = Object.values(resourceMatches).some((items) => items.length > 0);
    const fallbackResponse = hasMatches
      ? buildGroundedReply(safeMessage, safeContext, resourceMatches)
      : buildFallbackReply(safeMessage, safeContext);

    let response = fallbackResponse;
    let provider = getConfiguredAiProvider();
    let tokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let success = true;
    let fallbackUsed = provider !== 'openai';

    if (provider === 'openai') {
      try {
        const openAiResponse = await generateOpenAiReply({
          message: safeMessage,
          context: safeContext,
          history: safeHistory,
          resources: resourceMatches,
          promptVersion: resolvedPromptVersion,
        });
        response = {
          ...fallbackResponse,
          ...openAiResponse,
          resources: resourceMatches,
        };
        tokenUsage = openAiResponse.tokenUsage || tokenUsage;
      } catch (err) {
        providerError = err;
        provider = 'mock';
        success = false;
        fallbackUsed = true;
      }
    } else {
      provider = 'mock';
    }

    return {
      provider,
      ...response,
      sessionId,
      history: safeHistory,
      meta: buildMeta({
        provider,
        searchTerms,
        resourceMatches,
        tokenUsage,
        success,
        fallbackUsed,
        note: providerError
          ? `OpenAI generation failed. Returned the local tutor fallback response. ${providerError.message}`
          : (lookupError ? 'Resource lookup failed. Returned a study fallback response.' : undefined),
      }),
    };
  } catch (err) {
    const response = buildFallbackReply(safeMessage, safeContext);
    try {
      return {
        provider: 'mock',
        ...response,
        sessionId,
        history: safeHistory,
        meta: buildMeta({
          provider: 'mock',
          success: false,
          fallbackUsed: true,
          note: `Tutor pipeline recovered from an internal error. ${err.message}`,
        }),
      };
    } catch (_nestedErr) {
      return {
        provider: 'mock',
        ...buildFallbackReply('your topic', {}),
        sessionId,
        history: [],
        meta: {
          userId: user?.id || null,
          requestId,
          endpoint,
          model: fallbackModel,
          promptVersion: resolvedPromptVersion,
          responseTimeMs: Date.now() - startedAt,
          tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          success: false,
          fallbackUsed: true,
          note: `Tutor pipeline recovered from an internal error. ${err.message}`,
        },
      };
    }
  }
}

module.exports = { generateChatReply };
