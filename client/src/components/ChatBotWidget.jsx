import React, { useState } from 'react';
import { FaComments, FaTimes, FaPaperPlane } from 'react-icons/fa';

const faqMessages = [
  {
    question: 'How can I borrow a resource?',
    answer: 'Go to "Browse Resources", choose the item, then click "Borrow" and fill in the required fields. Your request will be sent to admin for approval.'
  },
  {
    question: 'Why can’t I borrow from another department?',
    answer: 'Students can only borrow resources that belong to their own department, plus shared resources. If your department is wrong, please contact the admin.'
  },
  {
    question: 'What are shared resources?',
    answer: 'Shared resources are items without a specific department. They are available for all departments (e.g. common textbooks or general equipment).'
  },
  {
    question: 'How long can I keep a resource?',
    answer: 'Each resource has a "Max Borrow Days" value. You will see it in the borrow dialog and in your borrow details.'
  },
  {
    question: 'What happens if I return late?',
    answer: 'Late return may create penalties according to UTAS rules. You can see your penalties in the "My Penalties" page.'
  }
];

const ChatBotWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      from: 'bot',
      text: "Hello! 👋 I'm your smart assistant at UTAS Borrowing Hub. How can I help you with borrowing your devices and resources today?"
    }
  ]);

  const findAnswer = (text) => {
    const lower = text.toLowerCase();

    // ====== تحية وسلام ======
    if (
      lower.includes('السلام عليكم') ||
      lower.includes('سلام عليكم') ||
      lower.includes('السلام') ||
      lower.includes('مرحبا') ||
      lower.includes('هلا') ||
      lower.includes('hello') ||
      lower.includes('hi')
    ) {
      return 'وعليكم السلام ورحمة الله وبركاته 🌷\nHow can I help you with UTAS Borrowing Hub today?';
    }

    // ====== أسئلة عن الاستعارة / الحجز ======
    if (
      lower.includes('borrow') ||
      lower.includes('استعارة') ||
      lower.includes('استعار') ||
      lower.includes('احجز') ||
      lower.includes('حجز') ||
      lower.includes('كيف أستعير') ||
      lower.includes('كيف استعار')
    ) {
      return faqMessages[0].answer;
    }

    // ====== أسئلة عن الأقسام والتخصصات ======
    if (
      lower.includes('department') ||
      lower.includes('قسم') ||
      lower.includes('تخصص') ||
      lower.includes('كلية') ||
      lower.includes('غير قسمي') ||
      lower.includes('قسم آخر')
    ) {
      return faqMessages[1].answer;
    }

    // ====== أسئلة عن الموارد المشتركة ======
    if (
      lower.includes('shared') ||
      lower.includes('مشتركة') ||
      lower.includes('مشترك') ||
      lower.includes('جميع الأقسام') ||
      lower.includes('كل الأقسام')
    ) {
      return faqMessages[2].answer;
    }

    // ====== أسئلة عن مدة الاستعارة ======
    if (
      lower.includes('days') ||
      lower.includes('day') ||
      lower.includes('مدة') ||
      lower.includes('كم يوم') ||
      lower.includes('max borrow') ||
      lower.includes('كم المدة') ||
      lower.includes('آخر موعد')
    ) {
      return faqMessages[3].answer;
    }

    // ====== أسئلة عن التأخير والغرامات ======
    if (
      lower.includes('late') ||
      lower.includes('متأخر') ||
      lower.includes('تأخير') ||
      lower.includes('غرامة') ||
      lower.includes('penalty') ||
      lower.includes('عقوبة') ||
      lower.includes('مخالفة')
    ) {
      return faqMessages[4].answer;
    }

    // ====== إجابة عامة إذا لم يتعرّف على السؤال ======
    return (
      "I couldn't fully understand this question. " +
      "Please try to ask about borrowing, departments, shared resources, borrowing duration, or penalties. " +
      "If it is something specific to UTAS rules, please contact the lab admin for an exact answer."
    );
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMessage = { from: 'user', text: trimmed };
    const botMessage = { from: 'bot', text: findAnswer(trimmed) };

    setMessages((prev) => [...prev, userMessage, botMessage]);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 2000
      }}
    >
      {isOpen && (
        <div
          style={{
            width: '320px',
            maxHeight: '460px',
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            marginBottom: '12px',
            border: '1px solid rgba(25,118,210,0.2)'
          }}
        >
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>UTAS Borrowing Assistant</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Ask me about borrowing & resources</div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer'
              }}
              aria-label="Close chat"
            >
              <FaTimes />
            </button>
          </div>

          <div
            style={{
              flex: 1,
              padding: '0.75rem',
              overflowY: 'auto',
              background: '#f5f7fb'
            }}
          >
            {messages.map((msg, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: msg.from === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: '0.5rem'
                }}
              >
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    lineHeight: 1.4,
                    background:
                      msg.from === 'user'
                        ? 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)'
                        : '#ffffff',
                    color: msg.from === 'user' ? '#fff' : '#333',
                    boxShadow:
                      msg.from === 'user'
                        ? '0 2px 6px rgba(25,118,210,0.35)'
                        : '0 1px 4px rgba(0,0,0,0.12)'
                  }}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Quick FAQ shortcuts */}
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#777', marginBottom: '0.25rem' }}>
                Quick questions:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                {faqMessages.slice(0, 3).map((item) => (
                  <button
                    key={item.question}
                    type="button"
                    onClick={() => {
                      setInput(item.question);
                      setTimeout(() => handleSend(), 0);
                    }}
                    style={{
                      border: 'none',
                      borderRadius: '999px',
                      padding: '0.25rem 0.6rem',
                      fontSize: '0.75rem',
                      background: '#e3f2fd',
                      color: '#1976d2',
                      cursor: 'pointer'
                    }}
                  >
                    {item.question}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '0.5rem',
              borderTop: '1px solid #e0e0e0',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your question..."
              rows={1}
              style={{
                flex: 1,
                borderRadius: '999px',
                border: '1px solid #e0e0e0',
                padding: '0.4rem 0.75rem',
                fontSize: '0.8rem',
                resize: 'none',
                outline: 'none'
              }}
            />
            <button
              type="button"
              onClick={handleSend}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                border: 'none',
                background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.25)'
              }}
              aria-label="Send message"
            >
              <FaPaperPlane size={14} />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          border: 'none',
          background: 'linear-gradient(135deg, #1976d2 0%, #ff9800 100%)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 6px 18px rgba(0,0,0,0.3)'
        }}
        aria-label="Open chat assistant"
      >
        <FaComments size={22} />
      </button>
    </div>
  );
};

export default ChatBotWidget;

