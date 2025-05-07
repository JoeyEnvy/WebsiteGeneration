require('dotenv').config();
const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: "sk-YvWsXDMQ4upqQfssB7wH6Uqnw3J81xIMUHhAEcg9iDT3BlbkFJRL6tH0whunQViQv5V1U74Qml2e8LIXNoPOWTPd7BQA"  // Add quotes around the key
});

async function testConnection() {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "user",
                    content: "Hello, this is a test!"
                }
            ]
        });
        console.log('Connection successful!');
        console.log('Response:', response.choices[0].message.content);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testConnection();