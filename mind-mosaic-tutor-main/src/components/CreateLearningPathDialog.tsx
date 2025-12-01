import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export const CreateLearningPathDialog = () => {
  const [open, setOpen] = useState(false);
  const [learningGoal, setLearningGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!learningGoal.trim()) {
      toast.error("Please describe what you want to learn");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("You must be logged in to create a learning path");
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-curriculum', {
        body: { learningGoal, userId: user.id }
      });

      if (error) throw error;

      toast.success("Learning path created successfully!");
      setOpen(false);
      setLearningGoal("");
      navigate(`/learning-path/${data.learningPathId}`);
    } catch (error) {
      console.error('Error creating learning path:', error);
      toast.error("Failed to create learning path. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="bg-gradient-primary hover:opacity-90 shadow-elevated">
          <Plus className="h-5 w-5 mr-2" />
          Create New Learning Path
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="h-6 w-6 text-primary" />
            Create Your Learning Path
          </DialogTitle>
          <DialogDescription className="text-base">
            Tell us what you want to learn, and our AI will create a personalized curriculum just for you.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="learningGoal" className="text-base font-medium">
              What do you want to learn?
            </Label>
            <Textarea
              id="learningGoal"
              placeholder="E.g., 'Learn web development with React and TypeScript' or 'Master Python for data science'"
              value={learningGoal}
              onChange={(e) => setLearningGoal(e.target.value)}
              className="min-h-[120px] text-base"
              disabled={loading}
            />
            <p className="text-sm text-muted-foreground">
              Be as specific as you like! The AI will create a structured curriculum with lessons and assignments.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !learningGoal.trim()}
              className="bg-gradient-primary hover:opacity-90"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Curriculum
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
