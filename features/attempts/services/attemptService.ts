// /features/attempts/services/attemptService.ts
import { supabase } from '@/lib/supabase';
import type { Attempt, AttemptMessage, AttemptFeedback } from '../models/attempt';
import type { Message } from '@/features/chat/models/chat';

// Create a new attempt
export async function createAttempt(caseId: string): Promise<Attempt | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('No authenticated user found');
      return null;
    }
    
    const title = `Attempt - ${new Date().toLocaleString()}`;
    
    const { data, error } = await supabase
      .from('attempts')
      .insert({
        user_id: user.id,
        case_id: caseId,
        title,
        last_stage_index: 0,
        completion_status: 'in_progress',
        time_spent_seconds: 0
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating attempt:', error);
      return null;
    }
    
    return transformAttempt(data);
  } catch (error) {
    console.error('Unexpected error creating attempt:', error);
    return null;
  }
}

// Save messages to an attempt
export async function saveMessages(attemptId: string, messages: Message[]): Promise<boolean> {
  const transformedMessages = messages.map(msg => ({
    attempt_id: attemptId,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
    stage_index: msg.stageIndex || 0,
    display_role: msg.displayRole
  }));
  
  const { error } = await supabase
    .from('attempt_messages')
    .insert(transformedMessages);
  
  if (error) {
    console.error('Error saving messages:', error);
    return false;
  }
  
  return true;
}

// Save feedback for a stage
export async function saveFeedback(
  attemptId: string, 
  stageIndex: number, 
  feedbackContent: string
): Promise<boolean> {
  const { error } = await supabase
    .from('attempt_feedback')
    .insert({
      attempt_id: attemptId,
      stage_index: stageIndex,
      feedback_content: feedbackContent
    });
  
  if (error) {
    console.error('Error saving feedback:', error);
    return false;
  }
  
  return true;
}

// Mark an attempt as complete
export async function completeAttempt(
  attemptId: string, 
  overallFeedback?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('attempts')
    .update({
      completed_at: new Date().toISOString(),
      completion_status: 'completed',
      overall_feedback: overallFeedback
    })
    .eq('id', attemptId);
  
  if (error) {
    console.error('Error completing attempt:', error);
    return false;
  }
  
  return true;
}

// Get all attempts for the current user
export async function getUserAttempts(): Promise<Attempt[]> {
  try {
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('No authenticated user found');
      return [];
    }
    
    const { data, error } = await supabase
      .from('attempts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching attempts:', error);
      return [];
    }
    
    return data.map(transformAttempt);
  } catch (error) {
    console.error('Unexpected error fetching attempts:', error);
    return [];
  }
}

// Get attempts for a specific case
export async function getAttemptsByCase(caseId: string): Promise<Attempt[]> {
  try {
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('No authenticated user found');
      return [];
    }
    
    const { data, error } = await supabase
      .from('attempts')
      .select('*')
      .eq('user_id', user.id)
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching attempts for case:', error);
      return [];
    }
    
    return data.map(transformAttempt);
  } catch (error) {
    console.error('Unexpected error fetching attempts for case:', error);
    return [];
  }
}

// Get a specific attempt with all messages and feedback
export async function getAttemptById(attemptId: string): Promise<{
  attempt: Attempt | null;
  messages: AttemptMessage[];
  feedback: AttemptFeedback[];
}> {
  // Get attempt
  const { data: attemptData, error: attemptError } = await supabase
    .from('attempts')
    .select('*')
    .eq('id', attemptId)
    .single();
  
  if (attemptError) {
    console.error('Error fetching attempt:', attemptError);
    return { attempt: null, messages: [], feedback: [] };
  }
  
  // Get messages
  const { data: messagesData, error: messagesError } = await supabase
    .from('attempt_messages')
    .select('*')
    .eq('attempt_id', attemptId)
    .order('timestamp', { ascending: true });
  
  if (messagesError) {
    console.error('Error fetching messages:', messagesError);
    return { attempt: transformAttempt(attemptData), messages: [], feedback: [] };
  }
  
  // Get feedback
  const { data: feedbackData, error: feedbackError } = await supabase
    .from('attempt_feedback')
    .select('*')
    .eq('attempt_id', attemptId)
    .order('stage_index', { ascending: true });
  
  if (feedbackError) {
    console.error('Error fetching feedback:', feedbackError);
    return { 
      attempt: transformAttempt(attemptData), 
      messages: messagesData.map(transformMessage), 
      feedback: [] 
    };
  }
  
  return {
    attempt: transformAttempt(attemptData),
    messages: messagesData.map(transformMessage),
    feedback: feedbackData.map(transformFeedback)
  };
}

// Delete an attempt
export async function deleteAttempt(attemptId: string): Promise<boolean> {
  const { error } = await supabase
    .from('attempts')
    .delete()
    .eq('id', attemptId);
  
  if (error) {
    console.error('Error deleting attempt:', error);
    return false;
  }
  
  return true;
}

// Save attempt progress
export async function saveAttemptProgress(
  attemptId: string,
  stageIndex: number,
  messages: Message[],
  timeSpentSeconds: number
): Promise<boolean> {
  try {
    // First update the attempt record
    const { error: updateError } = await supabase
      .from('attempts')
      .update({
        last_stage_index: stageIndex,
        time_spent_seconds: timeSpentSeconds
      })
      .eq('id', attemptId);
    
    if (updateError) {
      console.error('Error updating attempt progress:', updateError);
      return false;
    }
    
    // Then save the messages
    const success = await saveMessages(attemptId, messages);
    
    return success;
  } catch (error) {
    console.error('Unexpected error saving attempt progress:', error);
    return false;
  }
}

// Helper functions to transform database objects to our interfaces
function transformAttempt(data: any): Attempt {
  return {
    id: data.id,
    userId: data.user_id,
    caseId: data.case_id,
    title: data.title,
    createdAt: data.created_at,
    completedAt: data.completed_at,
    completionStatus: data.completion_status,
    overallFeedback: data.overall_feedback,
    lastStageIndex: data.last_stage_index,
    timeSpentSeconds: data.time_spent_seconds
  };
}

function transformMessage(data: any): AttemptMessage {
  return {
    id: data.id,
    attemptId: data.attempt_id,
    role: data.role,
    content: data.content,
    timestamp: data.timestamp,
    stageIndex: data.stage_index,
    displayRole: data.display_role
  };
}

function transformFeedback(data: any): AttemptFeedback {
  return {
    id: data.id,
    attemptId: data.attempt_id,
    stageIndex: data.stage_index,
    feedbackContent: data.feedback_content,
    createdAt: data.created_at
  };
}