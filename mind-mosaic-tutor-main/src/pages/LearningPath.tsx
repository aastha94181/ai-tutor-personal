import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { HelpChat } from "@/components/HelpChat";
import { ArrowLeft, CheckCircle2, Lock, Circle, Loader2, BookOpen, Youtube, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function LearningPath() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [learningPath, setLearningPath] = useState<any>(null);
  const [topics, setTopics] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [resources, setResources] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchLearningPath();
      fetchTopicsAndTasks();
    }
  }, [id]);

  const fetchLearningPath = async () => {
    try {
      const { data, error } = await supabase
        .from('learning_paths')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setLearningPath(data);
    } catch (error) {
      console.error('Error fetching learning path:', error);
      toast.error("Failed to load learning path");
    }
  };

  const fetchTopicsAndTasks = async () => {
    try {
      // Fetch topics
      const { data: topicsData, error: topicsError } = await supabase
        .from('topics')
        .select('*')
        .eq('learning_path_id', id)
        .order('topic_order', { ascending: true });

      if (topicsError) throw topicsError;

      // Fetch all tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('learning_path_id', id)
        .order('task_order', { ascending: true });

      if (tasksError) throw tasksError;

      setTopics(topicsData || []);
      setTasks(tasksData || []);
      
      // Fetch resources for all tasks
      if (tasksData && tasksData.length > 0) {
        const taskIds = tasksData.map(t => t.id);
        const { data: resourcesData, error: resourcesError } = await supabase
          .from('resources')
          .select('*')
          .in('task_id', taskIds)
          .order('created_at');

        if (!resourcesError && resourcesData) {
          // Group resources by task_id
          const groupedResources: Record<string, any[]> = {};
          resourcesData.forEach((resource: any) => {
            if (!groupedResources[resource.task_id]) {
              groupedResources[resource.task_id] = [];
            }
            groupedResources[resource.task_id].push(resource);
          });
          setResources(groupedResources);
        }
      }
    } catch (error) {
      console.error('Error fetching topics and tasks:', error);
      toast.error("Failed to load curriculum");
    } finally {
      setLoading(false);
    }
  };

  const getTaskIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'unlocked':
        return <Circle className="h-5 w-5 text-primary" />;
      default:
        return <Lock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!learningPath) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Learning path not found</h2>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const progress = (learningPath.completed_tasks / learningPath.total_tasks) * 100;

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card className="mb-8 shadow-elevated">
            <CardHeader>
              <CardTitle className="text-3xl">{learningPath.title}</CardTitle>
              <CardDescription className="text-base mt-2">
                {learningPath.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Overall Progress</span>
                  <span className="font-medium text-foreground">
                    {learningPath.completed_tasks} / {learningPath.total_tasks} tasks completed
                  </span>
                </div>
                <Progress value={progress} className="h-3" />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-8">
            {topics.length > 0 ? (
              topics.map((topic, topicIndex) => {
                const topicTasks = tasks.filter((_, taskIndex) => {
                  // Calculate which tasks belong to this topic
                  const tasksPerTopic = Math.ceil(tasks.length / topics.length);
                  const startIdx = topicIndex * tasksPerTopic;
                  const endIdx = startIdx + tasksPerTopic;
                  return taskIndex >= startIdx && taskIndex < endIdx;
                });

                return (
                  <div key={topic.id} className="space-y-4">
                    <Card className="bg-gradient-primary border-none">
                      <CardHeader className="pb-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-white/20 p-2 rounded-lg">
                            <BookOpen className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-xl text-white">
                              Chapter {topicIndex + 1}: {topic.title}
                            </CardTitle>
                            <CardDescription className="text-white/80 mt-1">
                              {topic.description}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>

                    <div className="pl-6 space-y-4 border-l-2 border-primary/20">
                      {topicTasks.map((task) => (
                        <Card 
                          key={task.id}
                          className={`transition-all ${
                            task.status === 'unlocked' ? 'hover:shadow-elevated cursor-pointer' : 'opacity-75'
                          }`}
                          onClick={() => {
                            if (task.status === 'unlocked') {
                              navigate(`/task/${task.id}`);
                            }
                          }}
                        >
                          <CardHeader>
                            <div className="flex items-start gap-4">
                              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary shrink-0">
                                {getTaskIcon(task.status)}
                              </div>
                              <div className="flex-1">
                                <CardTitle className="text-xl flex items-center gap-2">
                                  {task.title}
                                  {task.status === 'locked' && (
                                    <span className="text-sm font-normal text-muted-foreground">
                                      (Locked)
                                    </span>
                                  )}
                                </CardTitle>
                                <CardDescription className="mt-1">
                                  {task.description}
                                </CardDescription>
                                
                                {/* Display YouTube resources preview */}
                                {resources[task.id]?.filter(r => r.type === 'video').length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-3">
                                    {resources[task.id]
                                      .filter(r => r.type === 'video')
                                      .slice(0, 3)
                                      .map((resource) => (
                                        <a
                                          key={resource.id}
                                          href={resource.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="inline-flex items-center gap-1 text-xs bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-1 rounded hover:bg-red-500/20 transition-colors"
                                        >
                                          <Youtube className="h-3 w-3" />
                                          Video
                                        </a>
                                      ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          {task.status === 'unlocked' && (
                            <CardContent>
                              <Button 
                                className="bg-gradient-primary hover:opacity-90"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/task/${task.id}`);
                                }}
                              >
                                Start Task
                              </Button>
                            </CardContent>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              // Fallback for old curriculums without topics
              <div className="space-y-4">
                {tasks.map((task, index) => (
                  <Card 
                    key={task.id}
                    className={`transition-all ${
                      task.status === 'unlocked' ? 'hover:shadow-elevated cursor-pointer' : 'opacity-75'
                    }`}
                    onClick={() => {
                      if (task.status === 'unlocked') {
                        navigate(`/task/${task.id}`);
                      }
                    }}
                  >
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary shrink-0">
                          {getTaskIcon(task.status)}
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-xl flex items-center gap-2">
                            Task {index + 1}: {task.title}
                            {task.status === 'locked' && (
                              <span className="text-sm font-normal text-muted-foreground">
                                (Locked)
                              </span>
                            )}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {task.description}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    {task.status === 'unlocked' && (
                      <CardContent>
                        <Button 
                          className="bg-gradient-primary hover:opacity-90"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/task/${task.id}`);
                          }}
                        >
                          Start Task
                        </Button>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <HelpChat />
    </div>
  );
}
