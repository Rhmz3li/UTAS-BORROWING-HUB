import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button, Modal, ModalHeader, ModalBody, Input, InputGroup, Spinner } from "reactstrap";
import { FaRobot, FaComments, FaTrash, FaPlus, FaComment } from 'react-icons/fa';
import axios from 'axios';
import { FAQ_SUPPORT_INTRO, QUICK_QUESTIONS, QUICK_REPLIES, matchAbiFaq } from '../utils/abiFaq.js';

const Chatbot = () => {
    const [chatbotOpen, setChatbotOpen] = useState(false);
    const [chatMessage, setChatMessage] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [sessions, setSessions] = useState([]);
    const [activeSession, setActiveSession] = useState(null);
    const [chatMessages, setChatMessages] = useState([
        {
            type: 'bot',
            text: `Hello! I am the UTAS Borrowing Hub assistant.\n\n${FAQ_SUPPORT_INTRO}\n\nWhen you are logged in, I can also look up your borrows and the live resource catalog.`
        }
    ]);
    const messagesEndRef = useRef(null);

    const scrollToBottom = useCallback(() => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [chatMessages, chatLoading, scrollToBottom]);

    useEffect(() => {
        if (chatbotOpen) {
            fetchSessions();
        }
    }, [chatbotOpen]);

    const fetchSessions = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const response = await axios.get('http://localhost:5000/assistant/abi-chat/sessions', {
                headers: { Authorization: 'Bearer ' + token }
            });
            if (response.data?.success) {
                setSessions(response.data.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch chat sessions:', err);
        }
    };

    const loadSession = async (sessionId) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const response = await axios.get('http://localhost:5000/assistant/abi-chat/sessions/' + sessionId, {
                headers: { Authorization: 'Bearer ' + token }
            });
            if (response.data?.success) {
                const chat = response.data.data;
                const messages = (chat.messages || []).map(m => ({
                    type: m.role === 'user' ? 'user' : 'bot',
                    text: m.content || ''
                }));
                setChatMessages(messages.length ? messages : [
                    { type: 'bot', text: 'Hello! I am UTAS-BORROWING-HUB. How can I help you?' }
                ]);
                setActiveSession(sessionId);
            }
        } catch (err) {
            console.error('Failed to load session:', err);
        }
    };

    const deleteSession = async (sessionId, e) => {
        e.stopPropagation();
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            await axios.delete('http://localhost:5000/assistant/abi-chat/sessions/' + sessionId, {
                headers: { Authorization: 'Bearer ' + token }
            });
            if (activeSession === sessionId) {
                setActiveSession(null);
                setChatMessages([
                    { type: 'bot', text: 'Hello! I am UTAS-BORROWING-HUB. I can help with the UTAS Borrowing Hub system.' }
                ]);
            }
            fetchSessions();
        } catch (err) {
            console.error('Failed to delete session:', err);
        }
    };

    const newSession = () => {
        setActiveSession(null);
        setChatMessages([
            { type: 'bot', text: 'Hello! I am UTAS-BORROWING-HUB. How can I help you today?' }
        ]);
    };

    const handleSendChatMessage = async (presetMessage) => {
        const outgoingMessage = String(presetMessage || chatMessage).trim();
        if (!outgoingMessage || chatLoading) return;

        const userMessage = { type: 'user', text: outgoingMessage };
        setChatMessage('');

        const faqReply = matchAbiFaq(outgoingMessage);
        if (faqReply) {
            setChatMessages((prev) => [
                ...prev,
                userMessage,
                { type: 'bot', text: faqReply }
            ]);
            return;
        }

        setChatMessages((prev) => [...prev, userMessage]);
        setChatLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                'http://localhost:5000/assistant/abi-chat',
                { message: outgoingMessage, session_id: activeSession },
                { headers: { Authorization: 'Bearer ' + token } }
            );

            const reply = response.data?.data?.reply || 'UTAS-BORROWING-HUB could not generate a response right now.';
            const newSessionId = response.data?.data?.session_id;

            setChatMessages((prev) => [...prev, { type: 'bot', text: reply }]);

            if (newSessionId && !activeSession) {
                setActiveSession(newSessionId);
                fetchSessions();
            } else if (activeSession) {
                fetchSessions();
            }
        } catch (error) {
            console.error('UTAS-BORROWING-HUB chat error:', error);
            const errMsg = error.response?.data?.message || (error.response?.status === 401 ? 'Your session has expired. Please log in again.' : 'UTAS-BORROWING-HUB could not reply right now. Check server/.env for OPENROUTER_API_KEY or OPENAI_API_KEY or set USE_OLLAMA=true.');
            setChatMessages((prev) => [
                ...prev,
                { type: 'bot', text: errMsg }
            ]);
        } finally {
            setChatLoading(false);
        }
    };

    return (
        <>
            <Button
                color="primary"
                className="rounded-circle"
                title="AI Chatbot for Assistance \u2014 FAQ Support (borrowing rules, returns, availability)"
                style={{
                    position: 'fixed',
                    bottom: '30px',
                    right: '30px',
                    width: '60px',
                    height: '60px',
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}
                onClick={() => setChatbotOpen(true)}
            >
                <FaRobot size={24} />
            </Button>

            <Modal isOpen={chatbotOpen} toggle={() => setChatbotOpen(false)} size="md" style={{ maxWidth: '500px' }}>
                <ModalHeader toggle={() => setChatbotOpen(false)}>
                    <div>
                        <FaRobot className="me-2" />UTAS Borrowing Hub — AI Assistant
                        <small className="d-block text-muted fw-normal" style={{ fontSize: '0.72rem' }}>
                            FAQ Support: borrowing rules, return deadlines, availability
                        </small>
                    </div>
                </ModalHeader>
                <ModalBody style={{ padding: '0' }}>
                    <div style={{ display: 'flex', minHeight: '480px' }}>
                        <div style={{
                            width: '160px',
                            borderRight: '1px solid var(--border-color)',
                            background: 'var(--bg-tertiary)',
                            padding: '0.5rem',
                            overflowY: 'auto',
                            flexShrink: 0
                        }}>
                            <Button
                                size="sm"
                                color="primary"
                                block
                                style={{ marginBottom: '0.5rem', fontSize: '0.75rem' }}
                                onClick={newSession}
                            >
                                <FaPlus className="me-1" />New Chat
                            </Button>
                            {sessions.map((s) => (
                                <div
                                    key={s.session_id}
                                    onClick={() => loadSession(s.session_id)}
                                    style={{
                                        padding: '0.4rem 0.5rem',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '0.75rem',
                                        marginBottom: '0.25rem',
                                        background: activeSession === s.session_id ? 'var(--card-bg)' : 'transparent',
                                        color: 'var(--text-primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        wordBreak: 'break-word'
                                    }}
                                >
                                    <FaComment size={10} className="me-1" style={{ flexShrink: 0 }} />
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {s.title || 'Chat'}
                                    </span>
                                    <FaTrash
                                        size={10}
                                        style={{ flexShrink: 0, cursor: 'pointer', opacity: 0.5, marginLeft: '0.25rem' }}
                                        onClick={(e) => deleteSession(s.session_id, e)}
                                    />
                                </div>
                            ))}
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <div style={{
                                padding: '0.75rem',
                                overflowY: 'auto',
                                flex: 1,
                                maxHeight: '350px'
                            }}>
                                {chatMessages.length === 0 && (
                                    <div className="text-center mb-3">
                                        <FaRobot size={36} className="text-primary mb-2" />
                                        <p className="text-muted small">I am UTAS-BORROWING-HUB. How can I help you?</p>
                                    </div>
                                )}
                                {chatMessages.length > 0 && (
                                    <div className="mb-3">
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                            {QUICK_QUESTIONS.map((question) => (
                                                <Button
                                                    key={question}
                                                    size="sm"
                                                    color="light"
                                                    onClick={() => handleSendChatMessage(question)}
                                                    disabled={chatLoading}
                                                    style={{ borderRadius: '999px', fontSize: '0.7rem', padding: '0.25rem 0.6rem' }}
                                                >
                                                    {question}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {chatMessages.map((message, index) => (
                                    <div
                                        key={message.type + '-' + index}
                                        style={{
                                            display: 'flex',
                                            justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
                                            marginBottom: '0.6rem'
                                        }}
                                    >
                                        <div
                                            style={{
                                                maxWidth: '88%',
                                                padding: '0.55rem 0.8rem',
                                                borderRadius: '12px',
                                                background: message.type === 'user' ? '#1976d2' : 'var(--card-bg)',
                                                color: message.type === 'user' ? '#fff' : 'var(--text-primary)',
                                                border: message.type === 'user' ? 'none' : '1px solid var(--border-color)',
                                                whiteSpace: 'pre-wrap',
                                                lineHeight: 1.5,
                                                fontSize: '0.85rem'
                                            }}
                                        >
                                            {message.text}
                                        </div>
                                    </div>
                                ))}
                                {chatLoading && (
                                    <div className="d-flex align-items-center gap-2 text-muted small">
                                        <Spinner size="sm" />
                                        UTAS-BORROWING-HUB is typing...
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                            <div style={{
                                padding: '0.5rem 0.75rem',
                                borderTop: '1px solid var(--border-color)'
                            }}>
                                <InputGroup size="sm">
                                    <Input
                                        placeholder="Ask UTAS-BORROWING-HUB about the system..."
                                        value={chatMessage}
                                        onChange={(e) => setChatMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleSendChatMessage();
                                            }
                                        }}
                                    />
                                    <Button
                                        color="primary"
                                        onClick={() => handleSendChatMessage()}
                                        disabled={chatLoading || !chatMessage.trim()}
                                    >
                                        <FaComments />
                                    </Button>
                                </InputGroup>
                            </div>
                        </div>
                    </div>
                </ModalBody>
            </Modal>
        </>
    );
};

export default Chatbot;
