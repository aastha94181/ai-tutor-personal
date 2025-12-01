import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LearningPathCard } from "@/components/LearningPathCard";
import { CreateLearningPathDialog } from "@/components/CreateLearningPathDialog";
import { HelpChat } from "@/components/HelpChat";
import { Button } from "@/components/ui/button";
import { GraduationCap, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [learningPaths, setLearningPaths] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchLearningPaths();
  }, []);

  const fetchLearningPaths = async () => {
    try {
      const { data, error } = await supabase
        .from('learning_paths')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLearningPaths(data || []);
    } catch (error) {
      console.error('Error fetching learning paths:', error);
      toast.error("Failed to load learning paths");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-primary p-2 rounded-lg">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">AI Personal Tutor</h1>
                <p className="text-sm text-muted-foreground">Your personalized learning companion</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2">
                My Learning Paths
              </h2>
              <p className="text-muted-foreground">
                Continue your journey or start learning something new
              </p>
            </div>
            <CreateLearningPathDialog />
          </div>

          {learningPaths.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-gradient-primary p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <GraduationCap className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-semibold text-foreground mb-3">
                Start Your Learning Journey
              </h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Create your first learning path and let AI guide you through a personalized curriculum
              </p>
              <CreateLearningPathDialog />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {learningPaths.map((path) => (
                <LearningPathCard
                  key={path.id}
                  id={path.id}
                  title={path.title}
                  description={path.description}
                  totalTasks={path.total_tasks}
                  completedTasks={path.completed_tasks}
                  status={path.status}
                  createdAt={path.created_at}
                  onDelete={fetchLearningPaths}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      <HelpChat />
    </div>
  );
}
