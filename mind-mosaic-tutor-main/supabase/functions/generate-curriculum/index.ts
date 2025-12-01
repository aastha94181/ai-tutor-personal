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
    const { learningGoal, userId } = await req.json();

    if (!learningGoal || !userId) {
      throw new Error('Learning goal and user ID are required');
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log('Generating curriculum for:', learningGoal);

    // Call Lovable AI to generate curriculum
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
            content: `You are an expert educational curriculum designer. Create a comprehensive learning curriculum organized into topics (chapters) with multiple tasks under each topic.

STRUCTURE:
- Create 5-6 main topics (chapters) for a complete learning journey
- Each topic should have 3-4 tasks
- Total of 15-20 tasks across all topics
- Progress from basic fundamentals to advanced mastery
- Include practical, hands-on assignments

IMPORTANT: Keep lesson content concise (max 300 words per task). Focus on key concepts and practical examples.

Each task should include:
1. A clear, engaging title
2. A brief description (1-2 sentences)
3. Concise lesson content (key concepts, 2-3 examples max)
4. An assignment question to test understanding

You MUST respond with ONLY valid JSON, no markdown formatting, no code blocks.
Format your response EXACTLY like this:
{
  "title": "Course title",
  "description": "Course description",
  "topics": [
    {
      "title": "Topic/Chapter title",
      "description": "Topic description",
      "tasks": [
        {
          "title": "Task title",
          "description": "Task description",
          "content": "Concise lesson content with key concepts and examples",
          "assignment": "Assignment question"
        }
      ]
    }
  ]
}`
          },
          {
            role: "user",
            content: `Create a learning curriculum for: ${learningGoal}`
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.text();
      console.error('AI API error:', error);
      throw new Error(`AI API error: ${error}`);
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices[0].message.content;
    
    console.log('AI response length:', content.length);

    // Remove markdown code blocks if present
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    content = content.trim();

    // Try to find JSON object boundaries more carefully
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1) {
      console.error('No JSON object found in response');
      throw new Error('Invalid AI response format - no JSON object found');
    }

    const jsonString = content.substring(firstBrace, lastBrace + 1);
    
    let curriculum;
    try {
      curriculum = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Attempted to parse:', jsonString.substring(0, 500));
      const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown parse error';
      throw new Error(`Failed to parse AI response: ${errorMsg}`);
    }

    // Validate curriculum structure
    if (!curriculum.title || !curriculum.topics || !Array.isArray(curriculum.topics)) {
      throw new Error('Invalid curriculum structure from AI');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Count total tasks across all topics
    const totalTasks = curriculum.topics.reduce((sum: number, topic: any) => sum + topic.tasks.length, 0);

    // Create learning path
    const { data: learningPath, error: pathError } = await supabase
      .from('learning_paths')
      .insert({
        user_id: userId,
        title: curriculum.title,
        description: curriculum.description,
        total_tasks: totalTasks,
        completed_tasks: 0,
      })
      .select()
      .single();

    if (pathError) {
      console.error('Error creating learning path:', pathError);
      throw pathError;
    }

    console.log('Created learning path:', learningPath.id);

    // Create topics and tasks
    let globalTaskOrder = 1;
    
    for (let topicIndex = 0; topicIndex < curriculum.topics.length; topicIndex++) {
      const topic = curriculum.topics[topicIndex];

      // Create topic
      const { data: createdTopic, error: topicError } = await supabase
        .from('topics')
        .insert({
          learning_path_id: learningPath.id,
          title: topic.title,
          description: topic.description,
          topic_order: topicIndex + 1,
        })
        .select()
        .single();

      if (topicError) {
        console.error('Error creating topic:', topicError);
        throw topicError;
      }

      console.log(`Created topic: ${createdTopic.title}`);

      // Create tasks for this topic
      for (let taskIndex = 0; taskIndex < topic.tasks.length; taskIndex++) {
        const task = topic.tasks[taskIndex];
        
        // Determine difficulty level based on topic position
        const difficultyLevel = topicIndex === 0 ? 'beginner' : 
                               topicIndex === curriculum.topics.length - 1 ? 'advanced' : 
                               'intermediate';
        
        const { data: createdTask, error: taskError } = await supabase
          .from('tasks')
          .insert({
            learning_path_id: learningPath.id,
            title: task.title,
            description: task.description,
            content: task.content,
            task_order: globalTaskOrder++,
            status: (topicIndex === 0 && taskIndex === 0) ? 'unlocked' : 'locked',
            difficulty_level: difficultyLevel,
            estimated_time_minutes: 30 + (taskIndex * 10),
          })
          .select()
          .single();

        if (taskError) {
          console.error('Error creating task:', taskError);
          throw taskError;
        }

        // Fetch and store learning resources for this task
        try {
          console.log(`Fetching resources for task: ${task.title}`);
          await supabase.functions.invoke('fetch-resources', {
            body: {
              taskId: createdTask.id,
              topicId: createdTopic.id,
              topic: `${curriculum.title}: ${topic.title} - ${task.title}`,
              difficultyLevel: difficultyLevel,
            }
          });
        } catch (resourceError) {
          console.error('Error fetching resources for task:', resourceError);
          // Continue even if resource fetching fails
        }

        // Create assignment for the task
        const { error: assignmentError } = await supabase
          .from('assignments')
          .insert({
            task_id: createdTask.id,
            user_id: userId,
            question: task.assignment,
            status: 'pending',
          });

        if (assignmentError) {
          console.error('Error creating assignment:', assignmentError);
          throw assignmentError;
        }
      }
    }

    console.log('Curriculum created successfully');

    return new Response(
      JSON.stringify({ success: true, learningPathId: learningPath.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-curriculum:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
