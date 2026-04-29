import axios from 'axios';
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './App.css';

const API = 'https://anaya01-repochat.hf.space';

interface Message {
  role: 'user' | 'ai';
  content: string;
  followups?: string[];
}

function App() {
  const [repoUrl, setRepoUrl] = useState('');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState(0);
  const [indexingStage, setIndexingStage] = useState('');
  const indexingIntervalRef = useRef<any>(null);
  const [agentStep, setAgentStep] = useState('');
  const [fileFilter, setFileFilter] = useState('');
  const [showFileInput, setShowFileInput] = useState(false);
  const [fileInputVal, setFileInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const [repoHistory, setRepoHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('repochat_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [indexedRepo, setIndexedRepo] = useState<string>(() => {
    return localStorage.getItem('repochat_repo') || '';
  });

  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (indexedRepo) {
      const saved = localStorage.getItem(`repochat_messages_${indexedRepo}`);
      setMessages(saved ? JSON.parse(saved) : []);
    }
  }, [indexedRepo]);

  useEffect(() => {
    if (indexedRepo) {
      localStorage.setItem(
        `repochat_messages_${indexedRepo}`,
        JSON.stringify(messages)
      );
    }
  }, [messages, indexedRepo]);

  useEffect(() => {
    localStorage.setItem('repochat_repo', indexedRepo);
  }, [indexedRepo]);

  useEffect(() => {
    localStorage.setItem('repochat_history', JSON.stringify(repoHistory));
  }, [repoHistory]);

  useEffect(() => {
    const el = chatAreaRef.current;
    if (!el) return;
    const handleScroll = () => {
      setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 100);
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const startIndexingProgress = () => {
    setIndexingProgress(0);
    let p = 0;
    indexingIntervalRef.current = setInterval(() => {
      p += Math.random() * 6;
      if (p >= 92) p = 92;
      const rounded = Math.round(p);
      setIndexingProgress(rounded);
      if (rounded < 25) setIndexingStage('Cloning repository...');
      else if (rounded < 55) setIndexingStage('Processing files...');
      else if (rounded < 80) setIndexingStage('Generating embeddings...');
      else setIndexingStage('Storing in vector db...');
    }, 400);
  };

  const stopIndexingProgress = () => {
    clearInterval(indexingIntervalRef.current);
    setIndexingProgress(100);
    setIndexingStage('Done!');
    setTimeout(() => {
      setIndexingProgress(0);
      setIndexingStage('');
    }, 1000);
  };

  const handleIndex = async () => {
    if (!repoUrl) return;
    setIndexing(true);
    startIndexingProgress();
    try {
      await axios.post(`${API}/index`, { repo_url: repoUrl });
      stopIndexingProgress();
      setIndexedRepo(repoUrl);
      setRepoHistory((prev) =>
        prev.includes(repoUrl) ? prev : [...prev, repoUrl]
      );
      setMessages([
        {
          role: 'ai',
          content: `✅ Repo indexed! Ask me anything about **${repoUrl}**`,
        },
      ]);
    } catch (e) {
      stopIndexingProgress();
      setMessages([
        {
          role: 'ai',
          content: '❌ Failed to index repo. Check the URL and try again.',
        },
      ]);
    }
    setIndexing(false);
  };

  const handleChat = async (overrideMsg?: string) => {
    const userMsg = overrideMsg || question;
    if (!userMsg || !indexedRepo) return;
    setQuestion('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    setAgentStep('🔍 Retrieval agent searching codebase...');
    setTimeout(
      () => setAgentStep('🧠 Reasoning agent synthesizing answer...'),
      1500
    );
    setTimeout(
      () => setAgentStep('📎 Citation agent verifying sources...'),
      3000
    );
    try {
      const res = await axios.post(`${API}/chat`, {
        question: fileFilter
          ? `Specifically about file ${fileFilter}: ${userMsg}`
          : userMsg,
        repo_url: indexedRepo,
      });
      const fullAnswer = res.data.answer;
      const followups = res.data.followups || [];
      setLoading(false);
      setAgentStep('');
      setIsTyping(true);
      let i = 0;
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: '', followups: [] },
      ]);
      const interval = setInterval(() => {
        i += 8;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'ai',
            content: fullAnswer.slice(0, i),
            followups: i >= fullAnswer.length ? followups : [],
          };
          return updated;
        });
        if (i >= fullAnswer.length) {
          clearInterval(interval);
          setIsTyping(false);
        }
      }, 16);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: '❌ Something went wrong.' },
      ]);
      setLoading(false);
      setAgentStep('');
    }
  };

  return (
    <div style={styles.app}>
      <div style={styles.sidebar}>
        <div style={styles.logoRow}>
          <div style={styles.logoSq}>⚡</div>
          <span style={styles.logoText}>RepoChat</span>
        </div>

        <div style={styles.sideSection}>
          <div style={styles.sideLabel}>Index a repo</div>
          <input
            style={styles.repoInput}
            placeholder="https://github.com/user/repo"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleIndex()}
          />
          <button
            style={styles.indexBtn}
            onClick={handleIndex}
            disabled={indexing}
          >
            {indexing ? '⏳ Indexing...' : '+ Index repo'}
          </button>

          {indexing && (
            <div style={{ marginTop: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '5px',
                }}
              >
                <span style={{ fontSize: '10px', color: '#8b949e' }}>
                  {indexingStage}
                </span>
                <span style={{ fontSize: '10px', color: '#484f58' }}>
                  {indexingProgress}%
                </span>
              </div>
              <div
                style={{
                  height: '3px',
                  background: '#21262d',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${indexingProgress}%`,
                    background:
                      indexingProgress === 100 ? '#56d364' : '#7F77DD',
                    borderRadius: '2px',
                    transition: 'width 0.4s ease, background 0.3s ease',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {repoHistory.length > 0 && (
          <div style={styles.sideSection}>
            <div style={styles.sideLabel}>Indexed repos</div>
            {repoHistory.map((repo) => (
              <div
                key={repo}
                style={{
                  ...styles.repoChip,
                  marginBottom: '6px',
                  cursor: 'pointer',
                  border:
                    repo === indexedRepo
                      ? '0.5px solid #7F77DD'
                      : '0.5px solid #30363d',
                }}
                onClick={() => setIndexedRepo(repo)}
              >
                <span
                  style={{
                    ...styles.greenDot,
                    background: repo === indexedRepo ? '#56d364' : '#484f58',
                  }}
                ></span>
                <span style={styles.repoChipText}>
                  {repo.replace('https://github.com/', '')}
                </span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <button
                style={styles.smallBtn}
                onClick={() => {
                  setMessages([]);
                  if (indexedRepo)
                    localStorage.removeItem(`repochat_messages_${indexedRepo}`);
                }}
              >
                🗑 Clear chat
              </button>
              <button
                style={styles.smallBtn}
                onClick={() => {
                  setIndexedRepo('');
                  setMessages([]);
                  setIndexedRepo(repoUrl);
                  setRepoUrl('');
                  setRepoHistory((prev) =>
                    prev.includes(repoUrl) ? prev : [...prev, repoUrl]
                  );
                  setRepoHistory([]);
                  localStorage.clear();
                }}
              >
                🗑 Clear all
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={styles.main}>
        <div style={styles.topbar}>
          <div style={styles.topbarTitle}>
            {indexedRepo
              ? `💬 Chatting with ${indexedRepo.replace(
                  'https://github.com/',
                  ''
                )}`
              : 'Index a repo to start chatting'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {indexedRepo && <div style={styles.statusChip}>indexed</div>}
          </div>
        </div>

        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          <div ref={chatAreaRef} style={styles.chatArea}>
            {messages.length === 0 && (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>⚡</div>
                <div style={styles.emptyTitle}>Chat with any codebase</div>
                <div style={styles.emptyDesc}>
                  Paste a GitHub repo URL in the sidebar and start asking
                  questions about the code.
                </div>
                <div style={styles.exampleQuestions}>
                  {[
                    'How does auth work?',
                    'Where is the main entry point?',
                    'How are API routes structured?',
                  ].map((q) => (
                    <div
                      key={q}
                      style={styles.exampleQ}
                      onClick={() => handleChat(q)}
                    >
                      {q}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  ...styles.msgRow,
                  justifyContent:
                    msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                {msg.role === 'ai' && <div style={styles.aiAvatar}>RC</div>}
                {msg.role === 'ai' && (
                  <div style={{ maxWidth: '75%' }}>
                    {msg.role === 'ai' && (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          marginBottom: '4px',
                        }}
                      >
                        <button
                          onClick={() =>
                            navigator.clipboard.writeText(msg.content)
                          }
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '4px 6px',
                            cursor: 'pointer',
                            color: '#484f58',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '6px',
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.color = '#8b949e')
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.color = '#484f58')
                          }
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        </button>
                      </div>
                    )}
                    <div style={styles.aiBubble}>
                      <ReactMarkdown
                        components={{
                          code({ className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(
                              className || ''
                            );
                            const inline = !match;
                            return !inline ? (
                              <SyntaxHighlighter
                                style={oneDark}
                                language={match[1]}
                                PreTag="div"
                                customStyle={{
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                  margin: '8px 0',
                                  border: '0.5px solid #30363d',
                                }}
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            ) : (
                              <code
                                style={{
                                  background: '#0d1117',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  color: '#AFA9EC',
                                  fontFamily: 'monospace',
                                }}
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          },
                          a: ({ href, children }: any) => (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#7F77DD' }}
                            >
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    {msg.content && (
                      <div
                        style={{
                          marginTop: '8px',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '5px',
                        }}
                      >
                        {msg.content
                          .match(/`(\/[^`]+)`/g)
                          ?.filter((v, idx, a) => a.indexOf(v) === idx)
                          .map((match, idx) => {
                            const filePath = match.replace(/`/g, '');
                            const githubUrl = indexedRepo
                              ? `${indexedRepo}/blob/main${filePath}`
                              : '#';
                            return (
                              <a
                                key={idx}
                                href={githubUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: '#7F77DD15',
                                  border: '0.5px solid #534AB730',
                                  borderRadius: '20px',
                                  padding: '3px 10px',
                                  fontSize: '10px',
                                  color: '#AFA9EC',
                                  fontFamily: 'monospace',
                                  textDecoration: 'none',
                                }}
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.background =
                                    '#7F77DD25')
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.background =
                                    '#7F77DD15')
                                }
                              >
                                📄 {filePath}
                              </a>
                            );
                          })}
                      </div>
                    )}
                    {msg.followups && msg.followups.length > 0 && (
                      <div
                        style={{
                          marginTop: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '5px',
                        }}
                      >
                        {msg.followups.map((q, idx) => (
                          <div
                            key={idx}
                            style={styles.followupChip}
                            onClick={() => handleChat(q)}
                          >
                            ↗ {q}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {msg.role === 'user' && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      maxWidth: '75%',
                    }}
                  >
                    {editingIndex === i ? (
                      <div style={{ width: '100%' }}>
                        <textarea
                          autoFocus
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (editText.trim()) {
                                setMessages(messages.slice(0, i));
                                setEditingIndex(null);
                                handleChat(editText.trim());
                              }
                            }
                            if (e.key === 'Escape') setEditingIndex(null);
                          }}
                          style={{
                            width: '100%',
                            background: '#1D2D3E',
                            border: '0.5px solid #7F77DD',
                            borderRadius: '12px',
                            padding: '10px 14px',
                            fontSize: '13px',
                            color: '#e6edf3',
                            outline: 'none',
                            resize: 'none' as const,
                            lineHeight: 1.7,
                            minHeight: '60px',
                            fontFamily:
                              '-apple-system, BlinkMacSystemFont, sans-serif',
                          }}
                        />
                        <div
                          style={{
                            display: 'flex',
                            gap: '6px',
                            marginTop: '6px',
                            justifyContent: 'flex-end',
                          }}
                        >
                          <button
                            onClick={() => setEditingIndex(null)}
                            style={{
                              background: 'transparent',
                              border: '0.5px solid #30363d',
                              borderRadius: '6px',
                              padding: '4px 12px',
                              fontSize: '11px',
                              color: '#8b949e',
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              if (editText.trim()) {
                                setMessages(messages.slice(0, i));
                                setEditingIndex(null);
                                handleChat(editText.trim());
                              }
                            }}
                            style={{
                              background: '#7F77DD',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '4px 12px',
                              fontSize: '11px',
                              color: 'white',
                              cursor: 'pointer',
                            }}
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                        }}
                      >
                        <div style={styles.userBubble}>{msg.content}</div>
                        <button
                          onClick={() => {
                            setEditingIndex(i);
                            setEditText(msg.content);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '3px 6px',
                            marginTop: '3px',
                            cursor: 'pointer',
                            color: '#484f58',
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.color = '#8b949e')
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.color = '#484f58')
                          }
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {msg.role === 'user' && <div style={styles.userAvatar}>AC</div>}
              </div>
            ))}

            {loading && (
              <div style={styles.msgRow}>
                <div style={styles.aiAvatar}>RC</div>
                <div style={styles.agentTrace}>
                  <div style={styles.traceTitle}>Agent pipeline running</div>
                  <div style={styles.traceStep}>{agentStep}</div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {showScrollBtn && (
            <div
              onClick={() =>
                chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
              }
              style={{
                position: 'absolute',
                bottom: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '28px',
                height: '28px',
                background: '#161b22',
                border: '0.5px solid #30363d',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10,
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#8b949e"
                strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          )}
        </div>

        <div
          style={{
            borderTop: '0.5px solid #21262d',
            background: '#161b22',
            padding: '12px 20px',
          }}
        >
          {fileFilter && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontSize: '11px', color: '#484f58' }}>
                Filtering to:
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: '#7F77DD22',
                  border: '0.5px solid #534AB7',
                  borderRadius: '20px',
                  padding: '3px 10px',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    color: '#AFA9EC',
                    fontFamily: 'monospace',
                  }}
                >
                  📄 {fileFilter}
                </span>
                <span
                  onClick={() => setFileFilter('')}
                  style={{
                    fontSize: '11px',
                    color: '#534AB7',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  ✕
                </span>
              </div>
            </div>
          )}

          {showFileInput && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <input
                autoFocus
                style={{
                  flex: 1,
                  background: '#0d1117',
                  border: '0.5px solid #7F77DD',
                  borderRadius: '6px',
                  padding: '7px 12px',
                  fontSize: '12px',
                  color: '#e6edf3',
                  outline: 'none',
                  fontFamily: 'monospace',
                }}
                placeholder="Type filename e.g. router.js then press Enter"
                value={fileInputVal}
                onChange={(e) => setFileInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && fileInputVal.trim()) {
                    setFileFilter(fileInputVal.trim());
                    setFileInputVal('');
                    setShowFileInput(false);
                  }
                  if (e.key === 'Escape') {
                    setShowFileInput(false);
                    setFileInputVal('');
                  }
                }}
              />
              <button
                style={{
                  ...styles.smallBtn,
                  padding: '7px 12px',
                  fontSize: '11px',
                }}
                onClick={() => {
                  setShowFileInput(false);
                  setFileInputVal('');
                }}
              >
                Cancel
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#0d1117',
                border: '0.5px solid #30363d',
                borderRadius: '8px',
                padding: '0 12px',
              }}
            >
              <span
                onClick={() => setShowFileInput(!showFileInput)}
                style={{
                  fontSize: '11px',
                  cursor: 'pointer',
                  userSelect: 'none' as const,
                  color: fileFilter ? '#AFA9EC' : '#484f58',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  whiteSpace: 'nowrap' as const,
                }}
              >
                📄 <span style={{ fontSize: '10px' }}>file</span>
              </span>
              <input
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  padding: '10px 0',
                  fontSize: '13px',
                  color: '#e6edf3',
                  outline: 'none',
                  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                }}
                placeholder={
                  indexedRepo
                    ? 'Ask anything about this codebase...'
                    : 'Index a repo first...'
                }
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                disabled={!indexedRepo || loading || isTyping}
              />
            </div>
            <button
              style={styles.sendBtn}
              onClick={() => handleChat()}
              disabled={!indexedRepo || loading || isTyping}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  app: {
    display: 'flex',
    height: '100vh',
    background: '#0d1117',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  },
  sidebar: {
    width: '240px',
    background: '#010409',
    borderRight: '0.5px solid #21262d',
    display: 'flex',
    flexDirection: 'column',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '16px',
    borderBottom: '0.5px solid #21262d',
  },
  logoSq: {
    width: '28px',
    height: '28px',
    background: '#7F77DD',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
  },
  logoText: { fontSize: '14px', fontWeight: 500, color: '#e6edf3' },
  sideSection: { padding: '16px' },
  sideLabel: {
    fontSize: '10px',
    color: '#484f58',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.4px',
    marginBottom: '8px',
  },
  repoInput: {
    width: '100%',
    background: '#161b22',
    border: '0.5px solid #30363d',
    borderRadius: '6px',
    padding: '7px 10px',
    fontSize: '11px',
    color: '#e6edf3',
    outline: 'none',
    boxSizing: 'border-box' as const,
    fontFamily: 'monospace',
  },
  indexBtn: {
    marginTop: '8px',
    width: '100%',
    padding: '8px',
    background: '#7F77DD',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  repoChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: '#161b22',
    borderRadius: '6px',
    padding: '6px 8px',
  },
  greenDot: { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },
  repoChipText: {
    fontSize: '11px',
    color: '#8b949e',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    fontFamily: 'monospace',
  },
  smallBtn: {
    flex: 1,
    padding: '5px 6px',
    background: 'transparent',
    border: '0.5px solid #30363d',
    borderRadius: '6px',
    color: '#8b949e',
    fontSize: '10px',
    cursor: 'pointer',
  },
  main: { flex: 1, display: 'flex', flexDirection: 'column' },
  topbar: {
    background: '#161b22',
    borderBottom: '0.5px solid #21262d',
    padding: '10px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topbarTitle: { fontSize: '13px', color: '#8b949e' },
  statusChip: {
    fontSize: '10px',
    padding: '3px 10px',
    borderRadius: '10px',
    background: '#56d36410',
    border: '0.5px solid #56d36440',
    color: '#56d364',
  },
  chatArea: {
    height: '100%',
    padding: '20px',
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    textAlign: 'center' as const,
    gap: '12px',
    paddingTop: '80px',
  },
  emptyIcon: { fontSize: '40px' },
  emptyTitle: { fontSize: '18px', fontWeight: 500, color: '#e6edf3' },
  emptyDesc: {
    fontSize: '13px',
    color: '#8b949e',
    maxWidth: '340px',
    lineHeight: 1.6,
  },
  exampleQuestions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '8px',
  },
  exampleQ: {
    background: '#161b22',
    border: '0.5px solid #30363d',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '12px',
    color: '#8b949e',
    cursor: 'pointer',
  },
  msgRow: { display: 'flex', gap: '10px', alignItems: 'flex-start' },
  aiAvatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: '#7F77DD22',
    border: '0.5px solid #534AB7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    color: '#AFA9EC',
    flexShrink: 0,
  },
  userAvatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: '#1D9E7522',
    border: '0.5px solid #0F6E56',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    color: '#5DCAA5',
    flexShrink: 0,
  },
  aiBubble: {
    background: '#161b22',
    border: '0.5px solid #21262d',
    borderRadius: '12px',
    padding: '10px 14px',
    fontSize: '13px',
    color: '#e6edf3',
    lineHeight: 1.7,
  },
  userBubble: {
    background: '#1D2D3E',
    border: '0.5px solid #185FA5',
    borderRadius: '12px',
    padding: '10px 14px',
    fontSize: '13px',
    color: '#e6edf3',
    lineHeight: 1.7,
  },
  agentTrace: {
    background: '#0d1117',
    border: '0.5px solid #21262d',
    borderRadius: '8px',
    padding: '10px 14px',
  },
  traceTitle: { fontSize: '11px', color: '#484f58', marginBottom: '6px' },
  traceStep: { fontSize: '12px', color: '#e3b341', fontFamily: 'monospace' },
  followupChip: {
    background: '#0d1117',
    border: '0.5px solid #7F77DD44',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '11px',
    color: '#AFA9EC',
    cursor: 'pointer',
    display: 'inline-block',
  },
  sendBtn: {
    width: '36px',
    height: '36px',
    background: '#7F77DD',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

export default App;
