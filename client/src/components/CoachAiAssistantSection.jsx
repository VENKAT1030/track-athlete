import React, { useState } from 'react';
import api from '../services/api';
import {
  MessageSquare,
  Send,
  Sparkles,
  Bot,
  User,
  Shield,
  BookOpen,
  Award,
  Users,
  Briefcase,
  HelpCircle,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const SUGGESTED_PROMPTS = [
  'How can I add/manage athletes?',
  'How do Academy connections work?',
  'How can I apply for an Academy opening?',
  'How can I view athlete achievements?',
  'How do Coach requests work?',
  'How can I connect with another Coach?',
  'How can I manage my Coach profile?',
  'What do Federation Recognized and Organizer Verified achievements mean?'
];

export default function CoachAiAssistantSection({ currentCoachUser }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Hello Coach ${currentCoachUser?.name || ''}! 👋\n\nI am your **TrackAthlete AI Coach Assistant**. I can help you navigate your coaching dashboard, manage your athlete roster, apply for academy openings, connect with other coaches, and understand tournament verification standards.\n\nHow can I support your coaching workflow today?`
    }
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendPrompt = async (promptText) => {
    const textToSend = promptText || inputPrompt;
    if (!textToSend || !textToSend.trim() || loading) return;

    const userMsg = { id: Date.now().toString(), sender: 'user', text: textToSend.trim() };
    setMessages(prev => [...prev, userMsg]);
    if (!promptText) setInputPrompt('');
    setLoading(true);

    try {
      const res = await api.post('/coach/ai-assistant', { prompt: textToSend.trim() });
      const replyText = res.data?.reply || 'I could not process that query. Please try again.';
      const aiMsg = { id: (Date.now() + 1).toString(), sender: 'ai', text: replyText };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error('Error calling Coach AI Assistant:', err);
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: '⚠️ Coach AI Assistant service error. Please check your connection and try again.'
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-[#173d3c] via-[#123130] to-[#0c292c] border border-[#2f6d5a] p-6 rounded-2xl text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" /> AI Coach Assistant
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono text-[#c5d3ce] border border-white/20">
              TrackAthlete Domain Intelligence
            </span>
          </div>
          <h2 className="text-2xl font-normal text-white" style={{ fontFamily: 'Georgia, serif' }}>
            Professional Coaching <em style={{ color: '#b9d9bf', fontStyle: 'italic' }}>AI Assistant</em>
          </h2>
          <p className="text-xs text-[#c5d3ce] mt-1">
            Contextual assistance on roster management, academy openings, certifications, and coach networking.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/15 text-center shrink-0">
          <div className="text-[10px] text-[#c5d3ce] uppercase font-bold">Coach Profile Context</div>
          <div className="text-xs font-bold text-white mt-0.5">
            {currentCoachUser?.sports?.[0] || currentCoachUser?.sport || 'Sports'} · {currentCoachUser?.city || 'India'}
          </div>
        </div>
      </div>

      {/* QUICK SUGGESTED PROMPTS */}
      <div className="bg-white border border-[#e2e8f0] p-4 rounded-2xl shadow-sm space-y-2">
        <h3 className="text-xs font-bold text-[#173235] uppercase tracking-wider flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-[#2f6d5a]" /> Quick Topics & Helpful Questions:
        </h3>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendPrompt(p)}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-[#f4f6f4] hover:bg-[#e8eee9] border border-[#dce4de] text-[#173235] text-xs font-semibold cursor-pointer transition-all disabled:opacity-50 text-left"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* CHAT MESSAGES DISPLAY */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm flex flex-col h-[520px] overflow-hidden">
        <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-[#fbfdfb]">
          {messages.map(msg => {
            const isAi = msg.sender === 'ai';
            return (
              <div key={msg.id} className={`flex items-start gap-3 ${isAi ? 'justify-start' : 'justify-end'}`}>
                {isAi && (
                  <div className="w-8 h-8 rounded-xl bg-[#173d3c] border border-[#2f6d5a] flex items-center justify-center text-[#b9d9bf] shrink-0 mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] p-4 rounded-2xl text-xs leading-relaxed ${
                    isAi
                      ? 'bg-[#f4f8f5] border border-[#dceef0] text-[#173235] rounded-tl-none shadow-2xs'
                      : 'bg-[#173d3c] text-white rounded-tr-none shadow-2xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                </div>

                {!isAi && (
                  <div className="w-8 h-8 rounded-xl bg-[#e07050] flex items-center justify-center text-white shrink-0 mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-3 text-xs text-gray-500 italic py-2">
              <div className="w-7 h-7 rounded-xl bg-[#173d3c] flex items-center justify-center text-[#b9d9bf] animate-pulse">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <span>Analyzing TrackAthlete coach domain guidance...</span>
            </div>
          )}
        </div>

        {/* PROMPT INPUT FORM */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendPrompt();
          }}
          className="p-3 bg-white border-t border-gray-200 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder="Ask AI Coach Assistant any question about TrackAthlete..."
            className="flex-1 px-4 py-2.5 text-xs border border-gray-300 rounded-xl focus:outline-none focus:border-[#2f6d5a]"
          />
          <button
            type="submit"
            disabled={loading || !inputPrompt.trim()}
            className="px-5 py-2.5 rounded-xl bg-[#e07050] hover:bg-[#c85c40] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Ask AI</span>
          </button>
        </form>
      </div>
    </div>
  );
}
