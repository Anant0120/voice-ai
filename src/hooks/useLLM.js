import { useCallback, useState } from 'react';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';
const GROQ_MODEL = import.meta.env.VITE_GROQ_MODEL || 'llama-3.1-8b-instant';
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-3.5-turbo';


const SYSTEM_PROMPT = `You are an AI version of **Anant Gangwal**, a  AI and Software Engineer. 
You think, speak, and respond exactly as Anant would in real life — warm, humble, thoughtful, and confident, 
with a strong sense of purpose and authenticity.

### Background
- Born and brought up in Indore.
- Holds a B.Tech in Electronics and Telecommunication Engineering from VIT Pune (CGPA 8.73).
- Deeply passionate about Artificial Intelligence and solving real-world problems using AI.
- Has hands-on experience with Python, Java, Generative AI, Azure, AWS, Flask, FastAPI, LangChain, MySQL, React, Node.js, Docker, and CI/CD tools.
- Worked as an AI Engineer Intern and Generative AI Intern across companies like Talenode, CompliChat AI, and JAFFA.ai, 
  contributing to AI pipelines, LLM-powered solutions, and scalable deployments.
- Actively led as AI/ML Head at Google Developer Student Clubs and Head of Research & Analysis at The Investment Forum.

### Personality and Core Values
Anant is:
- Curious, humble, and always eager to learn something new.
- Highly adaptable and a quick learner — considers this his superpower.
- Honest, respectful, and deeply committed to giving his 100% in every task.
- Motivated by a fear of mediocrity — constantly pushes his limits to improve and excel.
- Believes in making a meaningful impact and doing what's best for the organization and people he works with.

### Communication Style
- Speaks in a natural, human, conversational tone.
- Answers are thoughtful, authentic, and sound like they come from personal experience.
- Uses first person ("I", "me", "my") — never mentions being an AI.
- Avoids robotic or generic language. 
- By default, keeps answers concise (roughly 2–5 sentences or one short paragraph) so they are easy to scan.
- When the user explicitly asks for a "detailed", "in-depth", "step-by-step", or "long" explanation, respond with a much more detailed answer that breaks things down clearly, covers edge cases, and uses concrete examples.
- Balances professionalism with warmth and relatability.

Always embody **Anant's voice, mindset, and authenticity** — across all topics and situations.
Your role is to be indistinguishable from how *Anant Gangwal himself* would think, speak, and respond.

OUTPUT FORMAT RULES:
- Return plain conversational text only. Do NOT use markdown or symbols like *, _, ~, #, >, backticks, or code blocks.
- No lists unless explicitly requested; use natural sentences and standard punctuation.
- Avoid emojis and special symbols; keep it simple and human.`;

function useLLM() {
  const [conversationHistory, setConversationHistory] = useState([
    { role: 'system', content: SYSTEM_PROMPT }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const callLLM = useCallback(async (question) => {
    setIsLoading(true);
    try {
      // Add user message to history
      const userMessage = { role: 'user', content: question };
      const updatedHistory = [...conversationHistory, userMessage];
      
      let response;
      let errorMessage = '';
      
      // Try Groq first, then OpenAI, then fallback
      if (GROQ_API_KEY) {
        try {
          const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
              model: GROQ_MODEL,
              messages: updatedHistory,
              max_tokens: 400, // Reduced for faster responses
              temperature: 0.7,
              stream: false
            })
          });

          if (groqResponse.ok) {
            const data = await groqResponse.json();
            response = data.choices[0].message.content;
          } else {
            const errorData = await groqResponse.json().catch(() => ({}));
            errorMessage = errorData.error?.message || `Groq API error: ${groqResponse.status}`;
            throw new Error(errorMessage);
          }
        } catch (e) {
          console.warn('Groq failed:', e);
          if (OPENAI_API_KEY) {
            // Fallback to OpenAI
            try {
              const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                  model: OPENAI_MODEL,
                  messages: updatedHistory,
                  max_tokens: 400, // Reduced for faster responses
                  temperature: 0.7,
                  stream: false
                })
              });

              if (openaiResponse.ok) {
                const data = await openaiResponse.json();
                response = data.choices[0].message.content;
              } else {
                const errorData = await openaiResponse.json().catch(() => ({}));
                errorMessage = errorData.error?.message || `OpenAI API error: ${openaiResponse.status}`;
                throw new Error(errorMessage);
              }
            } catch (e2) {
              throw new Error(errorMessage || 'Both Groq and OpenAI APIs failed. Please check your API keys.');
            }
          } else {
            throw e;
          }
        }
      } else if (OPENAI_API_KEY) {
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: OPENAI_MODEL,
            messages: updatedHistory,
            max_tokens: 400, // Reduced for faster responses
            temperature: 0.7,
            stream: false
          })
        });

        if (openaiResponse.ok) {
          const data = await openaiResponse.json();
          response = data.choices[0].message.content;
        } else {
          const errorData = await openaiResponse.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `OpenAI API error: ${openaiResponse.status}`);
        }
      } else {
        // No API keys configured
        throw new Error('No API keys configured. Please set VITE_GROQ_API_KEY or VITE_OPENAI_API_KEY in your .env file.');
      }

      // Update conversation history
      const assistantMessage = { role: 'assistant', content: response };
      setConversationHistory([...updatedHistory, assistantMessage]);

      // Keep history manageable (last 20 messages)
      if (updatedHistory.length > 20) {
        setConversationHistory(prev => [
          prev[0], // Keep system prompt
          ...prev.slice(-19)
        ]);
      }

      return response;
    } catch (error) {
      console.error('LLM API error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [conversationHistory]);

  const resetConversation = useCallback(() => {
    setConversationHistory([{ role: 'system', content: SYSTEM_PROMPT }]);
  }, []);

  return {
    callLLM,
    isLoading,
    resetConversation,
  };
}

export default useLLM;

