import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assignmentId, userAnswer } = await req.json();

    if (!assignmentId || !userAnswer) {
      throw new Error('Assignment ID and answer are required');
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log('Evaluating assignment:', assignmentId);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get assignment and task details
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('*, tasks(content, title, learning_path_id)')
      .eq('id', assignmentId)
      .single();

    if (assignmentError) {
      console.error('Error fetching assignment:', assignmentError);
      throw assignmentError;
    }

    // Call Lovable AI to evaluate the answer
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert educational evaluator. Evaluate the student's answer and provide:
            1. A score from 0-100
            2. Constructive feedback
            3. Suggestions for improvement
            
            Format your response as a JSON object:
            {
              "score": 85,
              "feedback": "Detailed feedback about what was good and what could be improved",
              "suggestions": "Specific suggestions for improvement"
            }`
          },
          {
            role: "user",
            content: `Task: ${assignment.tasks.title}
            
Lesson Content: ${assignment.tasks.content}

Assignment Question: ${assignment.question}

Student's Answer: ${userAnswer}

Please evaluate this answer and provide a score with detailed feedback.`
          }
        ],
        temperature: 0.5,
      }),
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.text();
      console.error('AI API error:', error);
      throw new Error(`AI API error: ${error}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    console.log('AI evaluation:', content);

    // Parse the AI response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid AI response format');
    }

    const evaluation = JSON.parse(jsonMatch[0]);

    // Update assignment with evaluation
    const { error: updateError } = await supabase
      .from('assignments')
      .update({
        user_answer: userAnswer,
        ai_evaluation: `${evaluation.feedback}\n\nSuggestions: ${evaluation.suggestions}`,
        score: evaluation.score,
        status: 'evaluated',
        submitted_at: new Date().toISOString(),
        evaluated_at: new Date().toISOString(),
      })
      .eq('id', assignmentId);

    if (updateError) {
      console.error('Error updating assignment:', updateError);
      throw updateError;
    }

    // If score is >= 70, mark task as completed and unlock next task
    if (evaluation.score >= 70) {
      const { data: task } = await supabase
        .from('tasks')
        .select('task_order, learning_path_id')
        .eq('id', assignment.task_id)
        .single();

      if (task) {
        // Mark current task as completed
        await supabase
          .from('tasks')
          .update({ status: 'completed' })
          .eq('id', assignment.task_id);

        // Unlock next task
        await supabase
          .from('tasks')
          .update({ status: 'unlocked' })
          .eq('learning_path_id', task.learning_path_id)
          .eq('task_order', task.task_order + 1);

        // Update learning path progress
        const { data: learningPath } = await supabase
          .from('learning_paths')
          .select('completed_tasks, total_tasks')
          .eq('id', task.learning_path_id)
          .single();

        if (learningPath) {
          const newCompletedTasks = learningPath.completed_tasks + 1;
          const newStatus = newCompletedTasks >= learningPath.total_tasks ? 'completed' : 'active';
          
          await supabase
            .from('learning_paths')
            .update({
              completed_tasks: newCompletedTasks,
              status: newStatus,
            })
            .eq('id', task.learning_path_id);
        }
      }
    }

    console.log('Evaluation completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        evaluation: {
          score: evaluation.score,
          feedback: evaluation.feedback,
          suggestions: evaluation.suggestions,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in evaluate-assignment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
