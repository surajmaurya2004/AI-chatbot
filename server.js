const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 5000;

let chatHistory = [];

// Keep only recent messages to reduce latency
const MAX_HISTORY_MESSAGES = 20;


// ===============================
// NEW CHAT
// ===============================

app.post("/api/new-chat", (req, res) => {

    chatHistory = [];

    console.log("🧹 Chat memory cleared");

    res.json({
        success: true,
        message: "New chat started"
    });

});


// ===============================
// CHAT
// ===============================

app.post("/api/chat", async (req, res) => {

    try {

        const { message } = req.body;

        if (!message || typeof message !== "string") {

            return res.status(400).json({
                error: "Message is required"
            });

        }

        // --------------------------------
        // Save user message
        // --------------------------------

        chatHistory.push({
            role: "user",
            parts: [
                {
                    text: message
                }
            ]
        });

        // Keep history limited
        if (chatHistory.length > MAX_HISTORY_MESSAGES) {
            chatHistory = chatHistory.slice(-MAX_HISTORY_MESSAGES);
        }

        console.log("👤 User:", message);

        const startTime = Date.now();

        // --------------------------------
        // Gemini Request
        // --------------------------------

        const response = await fetch(
           "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:streamGenerateContent?alt=sse",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": process.env.GEMINI_API_KEY
                },

                body: JSON.stringify({
                    contents: chatHistory
                })
            }
        );

        console.log(
            "⚡ Gemini headers:",
            Date.now() - startTime,
            "ms"
        );

        // --------------------------------
        // API Error
        // --------------------------------

        if (!response.ok) {

            const errorData = await response.json();

            console.log("❌ Gemini Error:", errorData);

            return res.status(response.status).json({
                error:
                    errorData.error?.message ||
                    "Gemini API error"
            });

        }

        // --------------------------------
        // SSE Headers
        // --------------------------------

        res.setHeader(
            "Content-Type",
            "text/event-stream"
        );

        res.setHeader(
            "Cache-Control",
            "no-cache"
        );

        res.setHeader(
            "Connection",
            "keep-alive"
        );

        // --------------------------------
        // Read Stream
        // --------------------------------

        const reader = response.body.getReader();

        const decoder = new TextDecoder();

        let buffer = "";

        let fullReply = "";

        let firstChunk = true;


        while (true) {

            const { value, done } =
                await reader.read();

            if (done) {
                break;
            }


            // Decode incoming chunk
            buffer += decoder.decode(
                value,
                {
                    stream: true
                }
            );


            const lines = buffer.split("\n");

            buffer = lines.pop();


            for (const line of lines) {

                if (!line.startsWith("data:")) {
                    continue;
                }


                const jsonText =
                    line.substring(5).trim();


                if (!jsonText) {
                    continue;
                }


                try {

                    const data =
                        JSON.parse(jsonText);


                    const text =
                        data.candidates?.[0]
                            ?.content?.parts?.[0]
                            ?.text;


                    if (text) {

                        // First token timing
                        if (firstChunk) {

                            console.log(
                                "🚀 First AI chunk:",
                                Date.now() - startTime,
                                "ms"
                            );

                            firstChunk = false;
                        }


                        fullReply += text;


                        // Send chunk to frontend
                        res.write(
                            `data: ${JSON.stringify({
                                text: text
                            })}\n\n`
                        );

                    }

                } catch (error) {

                    console.log(
                        "⚠️ Chunk parse error:",
                        error
                    );

                }

            }

        }


        // --------------------------------
        // Save AI response
        // --------------------------------

        if (fullReply) {

            chatHistory.push({
                role: "model",
                parts: [
                    {
                        text: fullReply
                    }
                ]
            });

        }


        console.log(
            "🤖 AI:",
            fullReply
        );


        console.log(
            "⏱️ Total response time:",
            Date.now() - startTime,
            "ms"
        );


        // --------------------------------
        // Finish stream
        // --------------------------------

        res.write(
            `data: ${JSON.stringify({
                done: true
            })}\n\n`
        );

        res.end();


    } catch (error) {

        console.error(
            "❌ Server Error:",
            error
        );


        if (!res.headersSent) {

            res.status(500).json({
                error: error.message
            });

        } else {

            res.end();

        }

    }

});


// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {

    console.log(
        `🚀 Backend running on http://localhost:${PORT}`
    );

});