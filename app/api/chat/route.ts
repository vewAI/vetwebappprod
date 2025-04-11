import OpenAi from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const openai = new OpenAi({
    apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
    try {
        const { messages } = await request.json();
        
        // Validate that messages is an array
        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json(
                { error: 'Messages array is required' },
                { status: 400 }
            );
        }
        
        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: messages,
            temperature: 0.7,
            max_tokens: 1000
        });
        
        return NextResponse.json({ 
            content: response.choices[0].message.content 
        });
    } catch (error) {
        console.error('Error in chat API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}