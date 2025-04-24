import { NextRequest, NextResponse } from 'next/server'
import OpenAi from 'openai'
import { case1RoleInfo } from '@/features/role-info/case1'

const openai = new OpenAi({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { messages, stageIndex, caseId, stageName } = await request.json()
    
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }
    
    // Only handle case-1 for now
    if (caseId !== "case-1") {
      return NextResponse.json(
        { error: 'Only case-1 is supported at this time' },
        { status: 400 }
      )
    }
    
    // Format the conversation context
    let context = ""
    messages.forEach(msg => {
      if (msg.role === "user") {
        context += `Student: ${msg.content}\n\n`
      } else if (msg.role === "assistant" && msg.useStageRole) {
        // Use the stage role or a default role based on stage type
        const roleLabel = stageName === "History Taking" ? "Client" : "Patient/Assistant"
        context += `${roleLabel}: ${msg.content}\n\n`
      }
    })
    
    // Get the appropriate feedback prompt based on the stage
    let feedbackPrompt = ""
    const availableStages = ["History Taking", "Owner Follow-up"]
    
    if (!availableStages.includes(stageName)) {
      return NextResponse.json(
        { error: 'Feedback is not available for this stage' },
        { status: 400 }
      )
    }
    
    switch (stageName) {
      case "History Taking":
        feedbackPrompt = case1RoleInfo.getHistoryFeedbackPrompt(context)
        break
      case "Owner Follow-up":
        feedbackPrompt = case1RoleInfo.getOwnerFollowUpFeedbackPrompt(context)
        break
      default:
        return NextResponse.json(
          { error: 'Feedback is not available for this stage' },
          { status: 400 }
        )
    }
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: feedbackPrompt }],
      temperature: 0.7,
      max_tokens: 1000
    })
    
    // Format the feedback with HTML
    const feedbackContent = response.choices[0].message.content || "No feedback available."
    
    // Convert markdown-like formatting to HTML
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
    
    // Wrap in paragraph tags if not already done
    const wrappedFeedback = `<p>${formattedFeedback}</p>`
      .replace(/<p><h([1-3])>/g, '<h$1>') // Fix nested paragraph tags
      .replace(/<\/h([1-3])><\/p>/g, '</h$1>') // Fix nested paragraph tags
      .replace(/<p><li>/g, '<li>') // Fix nested paragraph tags
      .replace(/<\/li><\/p>/g, '</li>') // Fix nested paragraph tags
      .replace(/<p><\/p>/g, '') // Remove empty paragraphs
    
    return NextResponse.json({ 
      feedback: wrappedFeedback
    })
  } catch (error) {
    console.error('Error in feedback API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}