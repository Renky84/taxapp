import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { Bot, Loader2, SendHorizontal, Sparkles, User } from "lucide-react";
import { useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const starterPrompts = [
  "このレシートは何費になりそう？",
  "今月の帳簿チェックで気を付ける点は？",
  "青色申告に向けて今週やることを整理して",
];

export default function AIAssistant() {
  const [input, setInput] = useState("");
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const [includeContext, setIncludeContext] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "こんにちは。帳簿・レシート・確定申告準備の相談をどうぞ。必要なら今月の帳簿状況も踏まえて答えます。" },
  ]);

  const { data: monthlyReport } = trpc.reports.getMonthlyReport.useQuery({ year: currentYear, month: currentMonth });
  const { data: filingCheck } = trpc.reports.getFilingCheck.useQuery({ year: currentYear });

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
    },
  });

  const sendMessage = async (content: string) => {
    const value = content.trim();
    if (!value || chatMutation.isPending) return;

    const nextMessages = [...messages, { role: "user" as const, content: value }];
    setMessages(nextMessages);
    setInput("");
    await chatMutation.mutateAsync({ messages: nextMessages, includeContext });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI相談</h1>
          <p className="text-gray-600 mt-2">帳簿の入力判断やレシート整理をその場で相談できます。</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-blue-600" /> 今の帳簿状況を使う</CardTitle>
            <CardDescription>オンにすると、今月の売上・経費・要確認件数を踏まえて回答します。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Button type="button" variant={includeContext ? "default" : "outline"} onClick={() => setIncludeContext(true)}>帳簿状況込み</Button>
              <Button type="button" variant={!includeContext ? "default" : "outline"} onClick={() => setIncludeContext(false)}>一般相談だけ</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-3 text-sm">
              <div className="rounded-xl border p-3">今月売上<br /><span className="text-lg font-semibold text-green-600">¥{(monthlyReport?.totalSales || 0).toLocaleString()}</span></div>
              <div className="rounded-xl border p-3">今月経費<br /><span className="text-lg font-semibold text-red-600">¥{(monthlyReport?.totalExpenses || 0).toLocaleString()}</span></div>
              <div className="rounded-xl border p-3">要確認<br /><span className="text-lg font-semibold text-amber-600">{filingCheck?.warningCount || 0}件</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>よくある相談</CardTitle>
            <CardDescription>ここから始めると入力の抜け漏れ確認に使いやすいです。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {starterPrompts.map((prompt) => (
              <Button key={prompt} type="button" variant="outline" onClick={() => sendMessage(prompt)}>
                {prompt}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card className="min-h-[560px]">
          <CardHeader>
            <CardTitle>税務アシスタント</CardTitle>
            <CardDescription>一般的な税務情報をもとに回答します。最終判断が必要な内容は税理士確認を前提に使ってください。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-[360px] rounded-md border p-4">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "assistant" ? "items-start" : "items-start justify-end"}`}>
                    {message.role === "assistant" && <Bot className="mt-1 h-5 w-5 text-blue-600" />}
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "assistant" ? "bg-slate-100 text-slate-900" : "bg-blue-600 text-white"}`}>
                      {message.content}
                    </div>
                    {message.role === "user" && <User className="mt-1 h-5 w-5 text-slate-600" />}
                  </div>
                ))}
                {chatMutation.isPending && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> AIが回答を作成しています
                  </div>
                )}
              </div>
            </ScrollArea>

            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage(input);
              }}
            >
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="例: この支出は消耗品費と雑費のどちらが自然？"
              />
              <Button type="submit" disabled={chatMutation.isPending}>
                <SendHorizontal className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
