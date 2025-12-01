-- Create topics table with hierarchy support
CREATE TABLE IF NOT EXISTS public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_path_id UUID NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  topic_order INTEGER NOT NULL,
  parent_topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create resources table for learning materials
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('video', 'article', 'code', 'quiz', 'documentation')),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  description TEXT,
  difficulty_level TEXT DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  thumbnail_url TEXT,
  duration TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_progress table for enhanced tracking
CREATE TABLE IF NOT EXISTS public.user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  time_spent_seconds INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  performance_score NUMERIC(5,2),
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, task_id)
);

-- Enhance tasks table
ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS difficulty_level TEXT DEFAULT 'beginner',
  ADD COLUMN IF NOT EXISTS estimated_time_minutes INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS resource_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add check constraint for difficulty_level if column was just added
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_difficulty_level_check'
  ) THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_difficulty_level_check 
      CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced'));
  END IF;
END $$;

-- Enhance assignments table
ALTER TABLE public.assignments 
  ADD COLUMN IF NOT EXISTS submission_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attempts_remaining INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS hint_used BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Enhance learning_paths table
ALTER TABLE public.learning_paths 
  ADD COLUMN IF NOT EXISTS adaptive_mode BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS current_difficulty_level TEXT DEFAULT 'beginner',
  ADD COLUMN IF NOT EXISTS performance_average NUMERIC(5,2) DEFAULT 0;

-- Add check constraint for learning_paths difficulty_level
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'learning_paths_difficulty_level_check'
  ) THEN
    ALTER TABLE public.learning_paths ADD CONSTRAINT learning_paths_difficulty_level_check 
      CHECK (current_difficulty_level IN ('beginner', 'intermediate', 'advanced'));
  END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view topics for their learning paths" ON public.topics;
DROP POLICY IF EXISTS "Users can view resources for their topics" ON public.resources;
DROP POLICY IF EXISTS "Users can view their own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can insert their own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can update their own progress" ON public.user_progress;

-- RLS policies for topics
CREATE POLICY "Users can view topics for their learning paths"
  ON public.topics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.learning_paths
      WHERE learning_paths.id = topics.learning_path_id
      AND learning_paths.user_id = auth.uid()
    )
  );

-- RLS policies for resources
CREATE POLICY "Users can view resources for their topics"
  ON public.resources FOR SELECT
  USING (
    (topic_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.topics
      JOIN public.learning_paths ON learning_paths.id = topics.learning_path_id
      WHERE topics.id = resources.topic_id
      AND learning_paths.user_id = auth.uid()
    )) OR
    (task_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.tasks
      JOIN public.learning_paths ON learning_paths.id = tasks.learning_path_id
      WHERE tasks.id = resources.task_id
      AND learning_paths.user_id = auth.uid()
    ))
  );

-- RLS policies for user_progress
CREATE POLICY "Users can view their own progress"
  ON public.user_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress"
  ON public.user_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress"
  ON public.user_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_topics_learning_path ON public.topics(learning_path_id);
CREATE INDEX IF NOT EXISTS idx_topics_parent ON public.topics(parent_topic_id);
CREATE INDEX IF NOT EXISTS idx_resources_topic ON public.resources(topic_id);
CREATE INDEX IF NOT EXISTS idx_resources_task ON public.resources(task_id);
CREATE INDEX IF NOT EXISTS idx_resources_type ON public.resources(type);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_task ON public.user_progress(user_id, task_id);

-- Create triggers for updating updated_at
DROP TRIGGER IF EXISTS update_topics_updated_at ON public.topics;
CREATE TRIGGER update_topics_updated_at
  BEFORE UPDATE ON public.topics
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_assignments_updated_at ON public.assignments;
CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_user_progress_updated_at ON public.user_progress;
CREATE TRIGGER update_user_progress_updated_at
  BEFORE UPDATE ON public.user_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();