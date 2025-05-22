import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { case1RoleInfo } from '@/features/role-info/case1'
import type { Message } from '@/features/chat/models/chat'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { caseId, messages } = await request.json()
    
    console.log('Generating overall feedback for case:', caseId)
    
    // Format messages into a context string for the feedback prompt
    const context = messages
      .map((msg: Message) => {
        const role = msg.role === 'user' ? 'Student' : msg.displayRole || 'Assistant'
        return `${role}: ${msg.content}`
      })
      .join('\n\n')
    
    // Get the appropriate prompt based on case ID
    let feedbackPrompt
    if (caseId === 'case-1') {
      if (typeof case1RoleInfo.getOverallFeedbackPrompt === 'function') {
        feedbackPrompt = case1RoleInfo.getOverallFeedbackPrompt(context)
      } else { //use directly as string if not function
        feedbackPrompt = case1RoleInfo.getOverallFeedbackPrompt
      }
    } else {
      return NextResponse.json(
        { error: 'Unsupported case ID' },
        { status: 400 }
      )
    }
    
    // Generate feedback using OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: feedbackPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    })
    
    const feedbackContent = response.choices[0].message.content || ''
    
    // Format the feedback with simple HTML using regex replacements
    const formattedFeedback = feedbackContent
      .replace(/\n\n/g, '</p><p>') // Convert double line breaks to paragraphs
      .replace(/\n/g, '<br>') // Convert single line breaks to <br>
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold text
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic text
      .replace(/^#\s+(.*?)$/gm, '<h1>$1</h1>') // H1
      .replace(/^##\s+(.*?)$/gm, '<h2>$1</h2>') // H2
      .replace(/^###\s+(.*?)$/gm, '<h3>$1</h3>') // H3
      .replace(/^(\d+\.\s+.*?)$/gm, '<li>$1</li>') // Numbered lists
      .replace(/^-\s+(.*?)$/gm, '<li>$1</li>') // Bullet points
    
    const wrappedFeedback = `<p>${formattedFeedback}</p>`
      .replace(/<p><h([1-3])>/g, '<h$1>') // Fix nested paragraph tags
      .replace(/<\/h([1-3])><\/p>/g, '</h$1>') // Fix nested paragraph tags
      .replace(/<p><li>/g, '<li>') // Fix nested paragraph tags
      .replace(/<\/li><\/p>/g, '</li>') // Fix nested paragraph tags
      .replace(/<p><\/p>/g, '') // Remove empty paragraphs
    
    return NextResponse.json({ feedback: wrappedFeedback })
  } catch (error) {
    console.error('Error generating overall feedback:', error)
    const errorMessage = `<p>Unable to generate feedback at this time. Please try again later.</p>`
    return NextResponse.json(
      { feedback: errorMessage, error: 'Failed to generate feedback' },
      { status: 500 }
    )
  }
}
