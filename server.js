const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet'); // ADD THIS
const { getModelForRequest } = require('./model-switcher');

dotenv.config();

const app = express();
// FIX: Use environment port for production
const port = process.env.PORT || 8000;
const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

// Define allowed origins
const allowedOrigins = [
  'http://localhost:5173', // Your local frontend
  process.env.FRONTEND_URL // Your deployed frontend URL from .env
].filter(Boolean); // Filter out undefined/null values

// Middleware
app.use(cors({ origin: allowedOrigins })); // Restrict requests to allowed origins
app.use(express.json()); // To parse JSON request bodies
app.use(helmet()); // ADD THIS for security

// --- Configure Gemini ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY not found in .env file");
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Minimum response time in milliseconds (10 seconds)
const MIN_RESPONSE_TIME_MS = 8000;

// **Add this route:**
app.get('/', (req, res) => {
  res.send('The server is up and running!');
});


// --- API Endpoint ---
app.post('/api/chat', async (req, res) => {
  const startTime = Date.now();
  try {
    const { history, message } = req.body;

    // More robust validation
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'A non-empty message string is required' });
    }

    if (history && !Array.isArray(history)) {
      return res.status(400).json({ error: 'If provided, history must be an array' });
    }

    // Dynamically select the model based on the input message length
    const { model } = await getModelForRequest(genAI, message);

    // FIX: Ensure history starts with a 'user' role if it's not empty.
    let sanitizedHistory = history || [];
    const firstUserIndex = sanitizedHistory.findIndex(item => item.role === 'user');
    if (firstUserIndex > 0) {
      sanitizedHistory = sanitizedHistory.slice(firstUserIndex);
    }

    // The genAI SDK expects a specific format for history.
    // We will build the prompt with history here.
    const chat = model.startChat({
      history: sanitizedHistory,
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    const endTime = Date.now();
    const duration = endTime - startTime;

    if (duration < MIN_RESPONSE_TIME_MS) {
      const delay = MIN_RESPONSE_TIME_MS - duration;
      console.log(`AI response took ${duration}ms. Waiting for an additional ${delay}ms.`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    res.json({ response: text }); // Send response after potential delay

  } catch (error) {
    console.error('Error communicating with Gemini API:', error);
    res.status(500).json({ error: 'Failed to get response from AI' });
  }
});


app.listen(port, host, () => {
  // FIX: Show the dynamic port and host
    console.log(`✅ Server running at http://${host}:${port}`);
});