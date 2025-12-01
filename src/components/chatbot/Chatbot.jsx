'use client';
import React, { useState, useRef, useEffect } from "react";
import { FiSend, FiMessageSquare } from "react-icons/fi";
import { BsRobot } from "react-icons/bs";
import { IoPersonCircleOutline } from "react-icons/io5";
import ReactMarkdown from 'react-markdown';
import { v4 as uuidv4 } from 'uuid'; // Install: npm install uuid

const ChatBot = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const chatBoxRef = useRef(null);

    // n8n Configuration
    const N8N_CONFIG = {
        webhookUrl: 'http://192.168.88.60:5678/webhook/285e5d0b-ffcf-44e8-a80c-0683966b78a4/chat',
        chatInputKey: 'chatInput',      // Default key n8n expects
        chatSessionKey: 'sessionId',     // Default session key
        enableStreaming: false,          // Set true if you enable streaming in Chat Trigger
    };

    // Initialize session on mount
    useEffect(() => {
        const storedSessionId = localStorage.getItem('n8n_chat_session');
        if (storedSessionId) {
            setSessionId(storedSessionId);
            // Optionally load previous session
            // loadPreviousSession(storedSessionId);
        } else {
            const newSessionId = uuidv4();
            setSessionId(newSessionId);
            localStorage.setItem('n8n_chat_session', newSessionId);
        }
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [messages]);

    // Load previous session (optional)
    const loadPreviousSession = async (sid) => {
        try {
            const response = await fetch(N8N_CONFIG.webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "loadPreviousSession",
                    [N8N_CONFIG.chatSessionKey]: sid,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                // Process previous messages if returned
                if (data?.data) {
                    const previousMessages = data.data.map((msg, idx) => ({
                        sender: msg.id.includes("HumanMessage") ? "user" : "bot",
                        text: msg.kwargs?.content || msg.text || "",
                        isMarkdown: true,
                    }));
                    setMessages(previousMessages);
                }
            }
        } catch (err) {
            console.error('Failed to load previous session:', err);
        }
    };

    // Send message to n8n
    const sendMessage = async () => {
        if (!input.trim() || !sessionId) return;

        const userMsg = { sender: "user", text: input };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        try {
            const payload = {
                action: "sendMessage",
                [N8N_CONFIG.chatInputKey]: input,
                [N8N_CONFIG.chatSessionKey]: sessionId,
                // Add metadata if needed
                // metadata: { userId: "user123", context: "sake brewing" }
            };

            const response = await fetch(N8N_CONFIG.webhookUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": N8N_CONFIG.enableStreaming ? "text/plain" : "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            let botReply = "";

            if (N8N_CONFIG.enableStreaming) {
                // Handle streaming response
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";

                const botMsg = { sender: "bot", text: "", isMarkdown: true };
                setMessages((prev) => [...prev, botMsg]);

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        if (line.trim()) {
                            try {
                                const chunk = JSON.parse(line);
                                if (chunk.type === "item" && chunk.content) {
                                    botReply += chunk.content;
                                    setMessages((prev) => {
                                        const updated = [...prev];
                                        updated[updated.length - 1] = {
                                            ...updated[updated.length - 1],
                                            text: botReply
                                        };
                                        return updated;
                                    });
                                }
                            } catch (e) {
                                // Not JSON, treat as plain text
                                botReply += line;
                                setMessages((prev) => {
                                    const updated = [...prev];
                                    updated[updated.length - 1] = {
                                        ...updated[updated.length - 1],
                                        text: botReply
                                    };
                                    return updated;
                                });
                            }
                        }
                    }
                }
            } else {
                // Handle non-streaming JSON response
                const data = await response.json();

                // Extract reply from n8n response
                botReply = data.output || data.text || data.message || data.reply || "";

                // If reply is JSON string, parse it
                if (typeof botReply === 'string' && botReply.trim().startsWith('{')) {
                    try {
                        const parsed = JSON.parse(botReply);
                        botReply = parsed.reply || parsed.output || parsed.text || botReply;
                    } catch (e) {
                        // Keep original if parsing fails
                    }
                }

                // Clean escape characters
                if (typeof botReply === 'string') {
                    botReply = botReply
                        .replace(/^\s*\{\s*"reply"\s*:\s*"/, "")
                        .replace(/"\s*\}\s*$/, "")
                        .replace(/\\n/g, '\n')
                        .replace(/\\"/g, '"')
                        .replace(/\\\*/g, '*')
                        .replace(/\\t/g, '\t');
                }

                setMessages((prev) => [
                    ...prev,
                    { sender: "bot", text: botReply, isMarkdown: true }
                ]);
            }

        } catch (err) {
            console.error('Chatbot error:', err);
            setMessages((prev) => [
                ...prev,
                { sender: "bot", text: "Error connecting to chatbot. Please try again.", isMarkdown: false },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const startNewSession = () => {
        const newSessionId = uuidv4();
        setSessionId(newSessionId);
        localStorage.setItem('n8n_chat_session', newSessionId);
        setMessages([]);
    };

    return (
        <div className="w-full max-w-2xl mx-auto mt-8 rounded-2xl shadow-2xl overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center gap-3 shadow-lg">
                <div className="bg-white/20 backdrop-blur-sm p-2 rounded-xl">
                    <BsRobot className="text-white text-2xl" />
                </div>
                <div className="flex-1">
                    <h2 className="text-white text-xl font-bold tracking-tight">Froppy AI</h2>
                    <p className="text-blue-100 text-sm">Sake Brewing Assistant</p>
                </div>
                <button
                    onClick={startNewSession}
                    className="text-white/80 hover:text-white text-xs underline"
                >
                    New Chat
                </button>
                <div>
                    <span className="flex items-center gap-2 text-white/90 text-xs">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                        Online
                    </span>
                </div>
            </div>

            {/* Chat Messages */}
            <div
                ref={chatBoxRef}
                className="h-[450px] overflow-y-auto px-6 py-4 space-y-4 bg-gradient-to-b from-slate-50 to-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent"
            >
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <FiMessageSquare className="text-slate-300 text-6xl mb-4" />
                        <p className="text-slate-400 font-medium">Hello I am Froppy ! How can I help you ?</p>
                        <p className="text-slate-300 text-sm mt-2">Ask me about sake brewing fermentation</p>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`flex items-start gap-3 ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"
                            }`}
                    >
                        {/* Avatar */}
                        <div
                            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-md ${msg.sender === "user"
                                ? "bg-gradient-to-br from-blue-500 to-blue-600"
                                : "bg-gradient-to-br from-green-500 to-emerald-600"
                                }`}
                        >
                            {msg.sender === "user" ? (
                                <IoPersonCircleOutline className="text-white text-2xl" />
                            ) : (
                                <BsRobot className="text-white text-xl" />
                            )}
                        </div>

                        {/* Message Bubble */}
                        <div
                            className={`max-w-[75%] px-4 py-3 rounded-2xl shadow-md transition-all duration-300 hover:shadow-lg ${msg.sender === "user"
                                ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-tr-sm"
                                : "bg-white text-slate-800 border border-slate-200 rounded-tl-sm"
                                }`}
                        >
                            {msg.isMarkdown && msg.sender === "bot" ? (
                                <div className="markdown-content text-sm leading-relaxed">
                                    <ReactMarkdown
                                        components={{
                                            h1: ({ node, ...props }) => <h1 className="text-xl font-bold text-slate-800 mb-3 mt-4 first:mt-0" {...props} />,
                                            h2: ({ node, ...props }) => <h2 className="text-lg font-bold text-slate-800 mb-2 mt-4 first:mt-0" {...props} />,
                                            h3: ({ node, ...props }) => <h3 className="text-base font-bold text-slate-800 mb-2 mt-3 first:mt-0" {...props} />,
                                            p: ({ node, ...props }) => <p className="text-slate-700 mb-2 leading-relaxed" {...props} />,
                                            ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-2 space-y-1" {...props} />,
                                            ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />,
                                            li: ({ node, ...props }) => <li className="text-slate-700 leading-relaxed" {...props} />,
                                            strong: ({ node, ...props }) => <strong className="font-semibold text-slate-900" {...props} />,
                                            em: ({ node, ...props }) => <em className="italic text-slate-700" {...props} />,
                                            code: ({ node, inline, ...props }) =>
                                                inline ? (
                                                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-slate-800" {...props} />
                                                ) : (
                                                    <code className="block bg-slate-100 p-3 rounded-lg text-xs font-mono text-slate-800 my-2 overflow-x-auto" {...props} />
                                                ),
                                            blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-slate-300 pl-4 italic text-slate-600 my-2" {...props} />,
                                            a: ({ node, ...props }) => <a className="text-blue-600 hover:text-blue-700 underline" {...props} />,
                                        }}
                                    >
                                        {msg.text}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                    {msg.text}
                                </p>
                            )}
                        </div>
                    </div>
                ))}

                {/* Typing Indicator */}
                {isLoading && (
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md">
                            <BsRobot className="text-white text-xl" />
                        </div>
                        <div className="bg-white px-5 py-3 rounded-2xl rounded-tl-sm border border-slate-200 shadow-md">
                            <div className="flex gap-1.5">
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="bg-white border-t border-slate-200 px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                        <textarea
                            ref={(el) => {
                                if (el) {
                                    el.style.height = 'auto';
                                    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                                }
                            }}
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none resize-none transition-all duration-200 text-slate-800 placeholder-slate-400 shadow-sm scrollbar-thin scrollbar-thumb-slate-300"
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                            }}
                            onKeyPress={handleKeyPress}
                            placeholder="Ask Froppy something..."
                            rows={1}
                            disabled={isLoading}
                            style={{
                                minHeight: '48px',
                                maxHeight: '120px',
                                overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden'
                            }}
                        />
                    </div>
                    <button
                        className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 shadow-lg ${input.trim() && !isLoading
                            ? "bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white hover:shadow-xl transform hover:scale-105 active:scale-95"
                            : "bg-slate-200 text-slate-400 cursor-not-allowed"
                            }`}
                        onClick={sendMessage}
                        disabled={!input.trim() || isLoading}
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <FiSend className="text-xl" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatBot;
