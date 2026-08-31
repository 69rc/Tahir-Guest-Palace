import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, PageLoader } from '../../components/ui/index.jsx';

const SUGGESTIONS = [
  "What was today's revenue?",
  'How many rooms are occupied?',
  'Which rooms are available?',
  'Which restaurant made the most money?',
  'What items are low in stock?',
  'How much is outstanding?',
  'How many guests are in the system?',
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (question) => {
    const q = (question || input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const res = await api.post('/ai/ask', { question: q });
      setMessages((m) => [...m, { role: 'assistant', text: res.data?.answer || 'No answer.' }]);
    } catch (e) {
      toast.error(e.message);
      setMessages((m) => [...m, { role: 'assistant', text: 'Sorry, I could not process that question.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-5">
        <div className="w-14 h-14 rounded-2xl bg-brand-600 text-white flex items-center justify-center mx-auto mb-3">
          <Bot size={28} />
        </div>
        <h1 className="text-2xl font-bold text-ink-900">AI Assistant</h1>
        <p className="text-sm text-ink-500 mt-1">Ask questions about your hotel operations — answers use live database figures</p>
      </div>

      <Card className="flex flex-col h-[520px]">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="text-center">
              <p className="text-sm text-ink-500 mb-4">Try asking:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} disabled={loading}
                    className="px-3 py-1.5 rounded-full border border-ink-200 text-sm text-ink-700 hover:bg-brand-50 hover:border-brand-300 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                m.role === 'user' ? 'bg-brand-600 text-white rounded-br-sm' : 'bg-ink-50 text-ink-800 rounded-bl-sm'
              }`}>
                {m.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-ink-50 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2 text-sm text-ink-500">
                <Sparkles size={14} className="animate-pulse" /> Thinking…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-ink-100 p-4">
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Ask about revenue, occupancy, stock, outstanding balances…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()}
              className="btn-primary !px-4 shrink-0">
              <Send size={16} />
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
