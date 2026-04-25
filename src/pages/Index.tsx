import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ChatMessage from "@/components/ChatMessage";
import QuestionInput from "@/components/QuestionInput";
import { useToast } from "@/hooks/use-toast";
import { Brain, Sparkles, LogOut, User as UserIcon, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import monkBackground from "@/assets/monk-background.jpg";
import type { User, Session } from "@supabase/supabase-js";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
}

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Fetch profile and messages when user signs in
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
            loadMessages(session.user.id);
          }, 0);
        } else {
          setDisplayName(null);
          setMessages([]);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      } else {
        fetchProfile(session.user.id);
        loadMessages(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle();
    
    setDisplayName(data?.display_name ?? null);
  };

  const loadMessages = async (userId: string) => {
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, message, is_user, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (data && !error) {
      setMessages(data.map(msg => ({
        id: msg.id,
        text: msg.message,
        isUser: msg.is_user
      })));
    }
    setLoadingMessages(false);
  };

  const saveMessage = async (text: string, isUser: boolean) => {
    if (!user) return;
    
    await supabase.from("chat_messages").insert({
      user_id: user.id,
      message: text,
      is_user: isUser
    });
  };

  const clearChat = async () => {
    if (!user) return;
    
    const { error } = await supabase
      .from("chat_messages")
      .delete()
      .eq("user_id", user.id);

    if (!error) {
      setMessages([]);
      toast({
        title: "Chat Cleared",
        description: "Your conversation history has been deleted.",
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (!user) {
    return null;
  }

  const handleQuestionSubmit = async (question: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      text: question,
      isUser: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setStreamingMessage("");

    // Save user message to database
    saveMessage(question, true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/answer-question`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ question }),
        }
      );

      if (!response.ok || !response.body) {
        if (response.status === 429) {
          toast({
            title: "Rate Limit Exceeded",
            description: "Too many requests. Please try again later.",
            variant: "destructive",
          });
          return;
        }
        if (response.status === 402) {
          toast({
            title: "Payment Required",
            description: "Please add credits to continue using AI features.",
            variant: "destructive",
          });
          return;
        }
        throw new Error("Failed to get answer");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              accumulatedText += content;
              setStreamingMessage(accumulatedText);
            }
          } catch (e) {
            console.error("Error parsing SSE:", e);
          }
        }
      }

      if (accumulatedText) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: accumulatedText,
          isUser: false,
        };
        setMessages((prev) => [...prev, aiMessage]);
        // Save AI response to database
        saveMessage(accumulatedText, false);
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to get an answer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setStreamingMessage("");
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${monkBackground})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/90 to-background/95" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent blur-lg opacity-50 rounded-full" />
                  <div className="relative bg-gradient-to-br from-primary to-accent p-2 rounded-full">
                    <Brain className="h-6 w-6 text-primary-foreground" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                      AI Question Answering
                    </h1>
                    <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full border border-primary/20">
                      GPT-5
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">Ask anything, get instant answers</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {displayName && (
                  <button
                    onClick={() => navigate("/profile")}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer"
                  >
                    <UserIcon className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">{displayName}</span>
                  </button>
                )}
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearChat}
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    title="Clear chat history"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/profile")}
                  className="h-9 w-9"
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex flex-col gap-6 min-h-[calc(100vh-200px)]">
          {/* Messages */}
          <div className="flex-1 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-20 text-center animate-fade-in">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 blur-3xl rounded-full" />
                  <Sparkles className="relative h-16 w-16 text-primary animate-pulse" />
                </div>
                <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Welcome to AI Q&A
                </h2>
                <p className="text-muted-foreground max-w-md">
                  Ask me any question and I'll provide you with detailed, accurate answers powered by advanced AI.
                </p>
              </div>
            )}

            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message.text}
                isUser={message.isUser}
              />
            ))}

            {streamingMessage && (
              <ChatMessage
                message={streamingMessage}
                isUser={false}
                isStreaming={true}
              />
            )}
          </div>

          {/* Input */}
          <div className="sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent pt-4">
            <QuestionInput onSubmit={handleQuestionSubmit} isLoading={isLoading} />
          </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
