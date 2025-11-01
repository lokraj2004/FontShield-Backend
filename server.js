const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet'); // ADD THIS
const { getModelForRequest } = require('./model-switcher');

dotenv.config();

const app = express();
// FIX: Use environment port for production
const port = process.env.PORT || 3001;

// Middleware
app.use(cors()); // Allow requests from our React frontend
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

    // The genAI SDK expects a specific format for history.
    // We will build the prompt with history here.
    const chat = model.startChat({
      history: history || [],
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

app.listen(port, () => {
  // FIX: Show the dynamic port
    console.log(`✅ Server running on port ${port}`);
});