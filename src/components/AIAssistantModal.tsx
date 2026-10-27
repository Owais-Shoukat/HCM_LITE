import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  X,
  Check,
  Calendar,
  UserCheck,
  Copy,
  RotateCcw,
  Trash2,
  Code2,
  Terminal,
  Cpu,
  ArrowRight
} from 'lucide-react';
import { apiRequest } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  toolCalls?: Array<{ name: string; args: any }>;
  smartLeaveAction?: {
    leaveType: 'annual' | 'sick' | 'casual' | 'unpaid';
    startDate: string;
    endDate: string;
    reason: string;
    workingDays: number;
  };
  timestamp: string;
  isError?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLeaveApplied?: () => void;
}

/**
 * Custom CodeBlock with Copy to Clipboard functionality
 */
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-white/10 bg-[#070915] font-mono text-xs shadow-lg">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0e122b] border-b border-white/5 text-slate-400">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-400 uppercase">
          <Terminal className="w-3.5 h-3.5" />
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-slate-200 leading-relaxed font-mono selection:bg-purple-600/40">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Intelligent Markdown formatter for chat messages
 */
function FormattedMessage({ text }: { text: string }) {
  // Check for code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-sm leading-relaxed break-words">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const content = part.slice(3, -3);
          const firstLineBreak = content.indexOf('\n');
          let lang = 'code';
          let codeText = content;

          if (firstLineBreak !== -1) {
            const firstLine = content.slice(0, firstLineBreak).trim();
            if (firstLine && !firstLine.includes(' ')) {
              lang = firstLine;
              codeText = content.slice(firstLineBreak + 1);
            }
          }

          return <CodeBlock key={index} code={codeText.trim()} language={lang} />;
        }

        // Standard text with bold, inline code, and lists
        const lines = part.split('\n');
        return (
          <div key={index} className="space-y-1">
            {lines.map((line, lIdx) => {
              if (!line.trim()) return <div key={lIdx} className="h-1.5" />;

              // Bullet points
              if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-2">
                    <span className="text-[#00f2fe] mt-1 text-xs">•</span>
                    <span>{renderInlineStyles(line.trim().slice(2))}</span>
                  </div>
                );
              }

              // Headings
              if (line.startsWith('### ')) {
                return (
                  <h4 key={lIdx} className="text-sm font-bold text-white pt-1">
                    {renderInlineStyles(line.slice(4))}
                  </h4>
                );
              }
              if (line.startsWith('## ')) {
                return (
                  <h3 key={lIdx} className="text-base font-bold text-white pt-1">
                    {renderInlineStyles(line.slice(3))}
                  </h3>
                );
              }

              return <p key={lIdx}>{renderInlineStyles(line)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

function renderInlineStyles(text: string): React.ReactNode {
  // Parse inline `code` and **bold**
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return tokens.map((token, i) => {
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded-md bg-[#0a0d24] text-cyan-300 font-mono text-xs border border-white/10">
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith('**') && token.endsWith('**')) {
      return (
        <strong key={i} className="font-bold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    }
    return token;
  });
}

export const AIAssistantModal: React.FC<Props> = ({ isOpen, onClose, onLeaveApplied }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      sender: 'assistant',
      text: `Hello ${user?.fullName || 'there'}! I am your AI Assistant for Saylani HCM Lite. You can ask me general questions about programming, writing emails, mathematics, or query real-time HCM attendance, personal leave balances, and company policies in English, Urdu, or Roman Urdu!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [applyingLeave, setApplyingLeave] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [messages, isOpen]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  if (!isOpen) return null;

  // Unrestricted starter prompt categories
  const starterPrompts = [
    { label: 'Teach me Python loops', query: 'Teach me Python loops from scratch with code examples.' },
    { label: 'Draft a professional email', query: 'Draft a professional email requesting a project review meeting.' },
    { label: 'Aj kitne log present hain?', query: 'Aj kitne log present hain?' },
    { label: 'Mera leave balance kitna hai?', query: 'Mera leave balance kitna hai?' },
    { label: 'Apply sick leave for tomorrow', query: 'Mujhe kal ki sick leave apply karni hai bukhar ki wajah se.' },
    { label: 'What is our office policy?', query: 'Explain the company office timings, grace period, and tax slabs.' }
  ];

  const handleSend = async (textToSend?: string) => {
    const prompt = (textToSend || input).trim();
    if (!prompt || loading) return;

    const userMsg: Message = {
      id: 'user_' + Date.now(),
      sender: 'user',
      text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    if (!textToSend) setInput('');
    setLoading(true);

    // Build history payload for multi-turn conversation
    const historyPayload = newMessages
      .filter((m) => m.id !== 'init' && !m.isError)
      .slice(-8)
      .map((m) => ({
        role: m.sender,
        content: m.text
      }));

    try {
      const res = await apiRequest<{
        answer: string;
        toolCalls?: any[];
        smartLeaveAction?: any;
      }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ prompt, history: historyPayload })
      });

      const aiMsg: Message = {
        id: 'ai_' + Date.now(),
        sender: 'assistant',
        text: res.answer,
        toolCalls: res.toolCalls,
        smartLeaveAction: res.smartLeaveAction,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          sender: 'assistant',
          text: err.message || 'Sorry, I encountered an error while processing your request. Please try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleConfirmSmartLeave = async (
    action: NonNullable<Message['smartLeaveAction']>,
    msgId: string
  ) => {
    setApplyingLeave(msgId);
    try {
      await apiRequest('/leaves', {
        method: 'POST',
        body: JSON.stringify({
          leaveType: action.leaveType,
          startDate: action.startDate,
          endDate: action.endDate,
          reason: action.reason
        })
      });

      setMessages((prev) => [
        ...prev,
        {
          id: 'confirm_' + Date.now(),
          sender: 'assistant',
          text: `✅ Leave request successfully submitted to HR for **${action.startDate}** to **${action.endDate}** (${action.workingDays} working days, ${action.leaveType.toUpperCase()} leave). Status is currently **Pending Approval**.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      if (onLeaveApplied) onLeaveApplied();
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_leave_' + Date.now(),
          sender: 'assistant',
          text: `❌ Could not submit leave request: ${err.message || 'Unknown error'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true
        }
      ]);
    } finally {
      setApplyingLeave(null);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'init',
        sender: 'assistant',
        text: `Chat cleared. Hello ${user?.fullName || 'there'}! How can I assist you today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#05060e]/85 backdrop-blur-md select-none">
      <div className="glass-panel w-full max-w-4xl h-[92vh] sm:h-[86vh] rounded-3xl flex flex-col overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(121,40,202,0.25)] relative">
        {/* Header HUD */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-[#14193d] via-[#0d1028] to-[#080b1e] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#7928ca] to-[#00f2fe] p-[1.5px] flex items-center justify-center shadow-lg">
                <div className="w-full h-full bg-[#0a0d24] rounded-[10px] flex items-center justify-center">
                  <Bot className="w-5 h-5 text-[#00f2fe]" />
                </div>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0a0d24] shadow-[0_0_6px_#10b981]"></span>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-sm sm:text-base text-white tracking-wide">
                  SAYLANI AI ASSISTANT
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30">
                  CHATGPT-GRADE // MULTI-TURN
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Conversational Intelligence • Urdu/Roman Urdu • Authoritative HCM
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleClearChat}
              title="Clear Conversation"
              className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              title="Close Assistant"
              className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 select-text">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
              >
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    {isUser ? user?.fullName || 'You' : 'Antigravity AI'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">{msg.timestamp}</span>
                </div>

                <div
                  className={`rounded-2xl px-4 py-3 max-w-[92%] sm:max-w-[85%] ${
                    isUser
                      ? 'bg-gradient-to-r from-[#7928ca] to-[#5b21b6] text-white shadow-lg shadow-purple-950/40 border border-purple-400/20'
                      : msg.isError
                      ? 'bg-rose-500/10 text-rose-200 border border-rose-500/30 shadow-md'
                      : 'glass-card text-slate-100 border border-white/10 shadow-md'
                  }`}
                >
                  <FormattedMessage text={msg.text} />

                  {/* Grounded Tool Invocation Badges */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                        <Cpu className="w-3 h-3 text-[#00f2fe]" /> Grounded Tools:
                      </span>
                      {msg.toolCalls.map((tc, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30"
                        >
                          {tc.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Smart Leave Action Card */}
                  {msg.smartLeaveAction && (
                    <div className="mt-3 p-3.5 rounded-xl bg-[#0a0d24] border border-[#00f2fe]/30 shadow-inner">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2 text-xs font-bold text-white">
                          <Calendar className="w-4 h-4 text-[#00f2fe]" />
                          <span>Smart Leave Application Draft</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#7928ca]/20 text-purple-300 border border-[#7928ca]/40">
                          {msg.smartLeaveAction.leaveType} Leave
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 my-2">
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-mono block">From</span>
                          <span className="font-semibold text-white">{msg.smartLeaveAction.startDate}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-mono block">To</span>
                          <span className="font-semibold text-white">{msg.smartLeaveAction.endDate}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-400 text-[10px] uppercase font-mono block">Working Days</span>
                          <span className="font-semibold text-cyan-400">
                            {msg.smartLeaveAction.workingDays} working day(s)
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => handleConfirmSmartLeave(msg.smartLeaveAction!, msg.id)}
                          disabled={applyingLeave === msg.id}
                          className="glow-btn-cyan px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{applyingLeave === msg.id ? 'Submitting...' : 'Confirm & Apply'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading Typing Indicator */}
          {loading && (
            <div className="flex items-start gap-2 max-w-[80%]">
              <div className="glass-card rounded-2xl px-4 py-3 border border-white/10 flex items-center space-x-2 text-xs text-slate-300">
                <div className="flex space-x-1">
                  <span className="w-2 h-2 rounded-full bg-[#00f2fe] animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-[#7928ca] animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 rounded-full bg-[#ff0080] animate-bounce [animation-delay:0.4s]"></span>
                </div>
                <span className="font-mono text-[11px] text-cyan-300 ml-1">Thinking & synthesizing...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Starter Chips Bar */}
        <div className="px-4 py-2 bg-[#090c24]/70 border-t border-white/5 flex gap-2 overflow-x-auto scrollbar-none">
          {starterPrompts.map((p, i) => (
            <button
              key={i}
              onClick={() => handleSend(p.query)}
              className="text-[11px] font-medium whitespace-nowrap px-3 py-1 rounded-full bg-[#121636]/60 border border-white/10 text-slate-300 hover:text-white hover:border-[#7928ca]/50 hover:bg-[#1a204d] transition-all cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Multiline Input Bar */}
        <div className="p-3 sm:p-4 bg-[#0a0d25]/90 border-t border-white/10">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-end gap-2"
          >
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything (Python code, emails, math, or Saylani HCM attendance)..."
                className="w-full pl-3.5 pr-10 py-2.5 text-sm cyber-input resize-none max-h-32 leading-relaxed"
              />
              <span className="hidden sm:inline-block absolute right-3 bottom-3 text-[10px] font-mono text-slate-500">
                ↵ to send
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="glow-btn-cyan p-2.5 rounded-xl disabled:opacity-40 cursor-pointer transition-all flex items-center justify-center shrink-0"
              title="Send Message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
