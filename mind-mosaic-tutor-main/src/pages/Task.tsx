import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { HelpChat } from "@/components/HelpChat";
import { ArrowLeft, Loader2, Send, CheckCircle2, Youtube, FileText, Github, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function Task() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<any>(null);
  const [assignment, setAssignment] = useState<any>(null);
  const [resources, setResources] = useState<any[]>([]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchTask();
      fetchAssignment();
      fetchResources();
    }
  }, [id]);

  const fetchTask = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, learning_paths(id, title)')
        .eq('id', id)
        .single();

      if (error) throw error;
      setTask(data);
    } catch (error) {
      console.error('Error fetching task:', error);
      toast.error("Failed to load task");
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignment = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('task_id', id)
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setAssignment(data);
      if (data?.user_answer) {
        setAnswer(data.user_answer);
      }
    } catch (error) {
      console.error('Error fetching assignment:', error);
    }
  };

  const fetchResources = async () => {
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('task_id', id)
        .order('created_at');

      if (error) throw error;
      setResources(data || []);
    } catch (error) {
      console.error('Error fetching resources:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!answer.trim()) {
      toast.error("Please provide an answer");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('evaluate-assignment', {
        body: { assignmentId: assignment.id, userAnswer: answer }
      });

      if (error) throw error;

      toast.success("Assignment evaluated successfully!");
      
      // Show evaluation results
      const evaluation = data.evaluation;
      const passScore = 70;
      
      if (evaluation.score >= passScore) {
        toast.success(
          `Great work! You scored ${evaluation.score}/100 and unlocked the next task!`,
          { duration: 5000 }
        );
      } else {
        toast.info(
          `You scored ${evaluation.score}/100. Review the feedback and try again to unlock the next task.`,
          { duration: 5000 }
        );
      }

      // Refresh assignment to show evaluation
      await fetchAssignment();
    } catch (error) {
      console.error('Error submitting assignment:', error);
      toast.error("Failed to submit assignment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Task not found</h2>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const isEvaluated = assignment?.status === 'evaluated';
  const score = assignment?.score || 0;

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate(`/learning-path/${task.learning_paths.id}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {task.learning_paths.title}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="text-3xl">{task.title}</CardTitle>
              <CardDescription className="text-base mt-2">
                {task.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="prose max-w-none">
              <div className="whitespace-pre-wrap text-foreground">
                {task.content}
              </div>
              
              {/* Display Learning Resources */}
              {resources.length > 0 && (
                <div className="mt-8 not-prose">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Learning Resources</h3>
                  <div className="grid gap-4">
                    {/* YouTube Videos */}
                    {resources.filter(r => r.type === 'video').length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                          <Youtube className="h-4 w-4 text-red-500" />
                          Video Tutorials
                        </h4>
                        <div className="grid gap-3">
                          {resources.filter(r => r.type === 'video').map((resource) => (
                            <a
                              key={resource.id}
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent transition-colors group"
                            >
                              {resource.thumbnail_url && (
                                <img 
                                  src={resource.thumbnail_url} 
                                  alt={resource.title}
                                  className="w-32 h-20 object-cover rounded flex-shrink-0"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <h5 className="font-medium text-foreground group-hover:text-primary line-clamp-2">
                                  {resource.title}
                                </h5>
                                {resource.description && (
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                    {resource.description}
                                  </p>
                                )}
                                {resource.duration && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Duration: {resource.duration}
                                  </p>
                                )}
                              </div>
                              <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Articles */}
                    {resources.filter(r => r.type === 'article').length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Articles & Documentation
                        </h4>
                        <div className="grid gap-2">
                          {resources.filter(r => r.type === 'article').map((resource) => (
                            <a
                              key={resource.id}
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors group"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="font-medium text-foreground group-hover:text-primary line-clamp-1">
                                  {resource.title}
                                </h5>
                                {resource.description && (
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                                    {resource.description}
                                  </p>
                                )}
                              </div>
                              <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* GitHub Repositories */}
                    {resources.filter(r => r.type === 'repository').length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                          <Github className="h-4 w-4" />
                          Code Examples & Projects
                        </h4>
                        <div className="grid gap-2">
                          {resources.filter(r => r.type === 'repository').map((resource) => (
                            <a
                              key={resource.id}
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors group"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="font-medium text-foreground group-hover:text-primary line-clamp-1">
                                  {resource.title}
                                </h5>
                                {resource.description && (
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                                    {resource.description}
                                  </p>
                                )}
                              </div>
                              <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                Assignment
                {isEvaluated && score >= 70 && (
                  <CheckCircle2 className="h-6 w-6 text-success" />
                )}
              </CardTitle>
              <CardDescription className="text-base">
                Complete this assignment to test your understanding
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-secondary/50 p-4 rounded-lg">
                <p className="font-medium text-foreground">{assignment?.question}</p>
              </div>

              {!isEvaluated ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="answer" className="text-base">Your Answer</Label>
                    <Textarea
                      id="answer"
                      placeholder="Write your answer here..."
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      className="min-h-[200px] text-base"
                      disabled={submitting}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={submitting || !answer.trim()}
                    className="bg-gradient-primary hover:opacity-90"
                    size="lg"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Evaluating...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Submit Assignment
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="bg-secondary/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Your Answer:</p>
                    <p className="text-foreground whitespace-pre-wrap">{assignment.user_answer}</p>
                  </div>

                  <div className={`p-4 rounded-lg ${score >= 70 ? 'bg-success/10 border border-success/20' : 'bg-warning/10 border border-warning/20'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-lg">Evaluation Results</h4>
                      <div className={`text-2xl font-bold ${score >= 70 ? 'text-success' : 'text-warning'}`}>
                        {score}/100
                      </div>
                    </div>
                    <div className="prose max-w-none">
                      <p className="text-foreground whitespace-pre-wrap">{assignment.ai_evaluation}</p>
                    </div>
                  </div>

                  {score >= 70 ? (
                    <Button
                      onClick={() => navigate(`/learning-path/${task.learning_paths.id}`)}
                      className="bg-gradient-accent hover:opacity-90"
                      size="lg"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Continue to Next Task
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        setAnswer("");
                        fetchAssignment();
                      }}
                      variant="outline"
                      size="lg"
                    >
                      Try Again
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <HelpChat 
        taskContext={{
          title: task.title,
          description: task.description,
          content: task.content,
          question: assignment?.question
        }}
      />
    </div>
  );
}
