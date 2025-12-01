import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BookOpen, CheckCircle2, Clock, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

interface LearningPathCardProps {
  id: string;
  title: string;
  description: string;
  totalTasks: number;
  completedTasks: number;
  status: string;
  createdAt: string;
  onDelete?: () => void;
}

export const LearningPathCard = ({
  id,
  title,
  description,
  totalTasks,
  completedTasks,
  status,
  createdAt,
  onDelete,
}: LearningPathCardProps) => {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const progress = (completedTasks / totalTasks) * 100;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    
    try {
      const { error } = await supabase
        .from('learning_paths')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success("Learning path deleted successfully");
      onDelete?.();
    } catch (error) {
      console.error('Error deleting learning path:', error);
      toast.error("Failed to delete learning path");
    } finally {
      setIsDeleting(false);
    }
  };
  
  const statusConfig = {
    active: { icon: Clock, color: "text-primary", bgColor: "bg-secondary" },
    completed: { icon: CheckCircle2, color: "text-success", bgColor: "bg-success/10" },
    paused: { icon: Clock, color: "text-muted-foreground", bgColor: "bg-muted" },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
  const StatusIcon = config.icon;

  return (
    <Card 
      className="hover:shadow-elevated transition-all duration-300 cursor-pointer group"
      onClick={() => navigate(`/learning-path/${id}`)}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl group-hover:text-primary transition-colors">
              {title}
            </CardTitle>
            <CardDescription className="mt-2 line-clamp-2">
              {description}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={(e) => e.stopPropagation()}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Learning Path</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{title}"? This action cannot be undone and will remove all associated tasks and progress.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className={`${config.bgColor} ${config.color} p-2 rounded-lg`}>
              <StatusIcon className="h-5 w-5" />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium text-foreground">
                {completedTasks} / {totalTasks} tasks
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              <span>{totalTasks} tasks</span>
            </div>
            <Button 
              size="sm" 
              className="bg-gradient-primary hover:opacity-90"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/learning-path/${id}`);
              }}
            >
              Continue Learning
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
