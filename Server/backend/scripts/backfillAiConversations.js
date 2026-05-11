require('dotenv').config();

const mongoose = require('mongoose');
const { validateEnv } = require('../config/validateEnv');
const { backfillAiConversationConsistency } = require('../services/aiConversationConsistencyService');
const { logger } = require('../utils/logger');

async function main() {
  validateEnv();

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const sessionIdArg = args.find((arg) => arg.startsWith('--sessionId='));
  const limitArg = args.find((arg) => arg.startsWith('--limit='));

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });

  try {
    const result = await backfillAiConversationConsistency({
      dryRun,
      sessionId: sessionIdArg ? sessionIdArg.split('=')[1] : undefined,
      limit: limitArg ? Number(limitArg.split('=')[1]) : undefined,
    });
    logger.info(result, 'ai_conversation_backfill_complete');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  logger.error({ err: err.message }, 'ai_conversation_backfill_failed');
  process.exit(1);
});
