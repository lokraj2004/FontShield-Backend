const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
dotenv.config();

const DEFAULT_MODEL_NAME = process.env.GEMINI_DEFAULT_MODEL;
const LONG_CONTEXT_MODEL_NAME = process.env.GEMINI_LONG_CONTEXT_MODEL; // A powerful model for larger inputs
const TOKEN_THRESHOLD = 500;

/**
 * Selects the generative model based on the token count of the input message.
 * @param {GoogleGenerativeAI} genAI - The GoogleGenerativeAI instance.
 * @param {string} message - The user's input message.
 * @returns {Promise<{model: import('@google/generative-ai').GenerativeModel}>} - A promise that resolves to an object containing the selected model instance.
 */
async function getModelForRequest(genAI, message) {
  // We use the default model to count tokens as it's generally faster and cheaper.
  const defaultModel = genAI.getGenerativeModel({ model: DEFAULT_MODEL_NAME });

  try {
    const { totalTokens } = await defaultModel.countTokens(message);

    console.log(`Input message token count: ${totalTokens}`);

    if (totalTokens >= TOKEN_THRESHOLD) {
      console.log(`Token count ${totalTokens} exceeds threshold of ${TOKEN_THRESHOLD}. Switching to long-context model.`);
      const longContextModel = genAI.getGenerativeModel({ model: LONG_CONTEXT_MODEL_NAME });
      return { model: longContextModel };
    }
  } catch (error) {
    console.error("Error counting tokens, falling back to default model:", error);
    // If token counting fails for any reason, we'll just use the default model.
    return { model: defaultModel };
  }

  console.log(`Token count is within threshold. Using default model.`);
  return { model: defaultModel };
}

module.exports = { getModelForRequest };