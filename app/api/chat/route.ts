import OpenAi from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { getRoleInfoPrompt } from '@/features/role-info/services/roleInfoService';

const openai = new OpenAi({
    apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
    try {
        const { messages, stageIndex, caseId } = await request.json();
        
        // Validate that messages is an array
        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json(
                { error: 'Messages array is required' },
                { status: 400 }
            );
        }
        
        const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user');
        let enhancedMessages = [...messages];
        
        // If we have a valid caseId, stageIndex and a user message, try to get role info prompt
        if (caseId && stageIndex !== undefined && lastUserMessage) {
            const roleInfoPrompt = getRoleInfoPrompt(caseId, stageIndex, lastUserMessage.content);
            
            if (roleInfoPrompt) {
                enhancedMessages.unshift({
                    role: 'system',
                    content: roleInfoPrompt
                });
            }
        }
        
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: enhancedMessages,
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