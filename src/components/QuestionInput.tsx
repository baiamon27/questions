import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

interface QuestionInputProps {
  onSubmit: (question: string) => void;
  isLoading: boolean;
}

const QuestionInput = ({ onSubmit, isLoading }: QuestionInputProps) => {
  const [question, setQuestion] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim() && !isLoading) {
      onSubmit(question.trim());
      setQuestion("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <Textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask me anything..."
        className="min-h-[100px] pr-12 resize-none bg-card border-border focus:border-primary transition-colors"
        disabled={isLoading}
      />
      <Button
        type="submit"
        size="icon"
        disabled={!question.trim() || isLoading}
        className="absolute bottom-3 right-3 h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent hover:shadow-glow transition-all duration-200"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
};

export default QuestionInput;
