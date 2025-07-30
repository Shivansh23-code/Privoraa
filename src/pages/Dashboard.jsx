import React from "react";
import styles from "./Dashboard.module.css";
import { useUserAuth } from "../context/UserAuthContext";

export default function Dashboard() {
  const { user, logOut } = useUserAuth();

  const handleLogout = async () => {
    try {
      await logOut();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className={styles.dashboard}>
      {/* Left Sidebar */}
      <aside className={styles.sidebarLeft}>
        <div className={styles.logo}>🤖 AI ChatBot</div>

        <div className={styles.section}>
          <input
            type="text"
            placeholder="Search..."
            className={styles.searchInput}
          />
        </div>

        <div className={styles.section}>
          <h3>AI Models</h3>
          <ul>
            <li className={styles.active}>GPT-4 Turbo</li>
            <li>Claude 3</li>
            <li>Gemini Pro</li>
          </ul>
        </div>

        <div className={styles.section}>
          <h3>Recent Conversations</h3>
          <ul>
            <li>Project Update — 5m ago</li>
            <li>Resume Review — 1h ago</li>
          </ul>
        </div>

        <button className={styles.newChat}>+ New AI Chat</button>
      </aside>

      {/* Center Chat Panel */}
      <main className={styles.chatPanel}>
        <header className={styles.chatHeader}>
          <div>
            <h2>AI Assistant</h2>
            <span className={styles.status}>🟢 Online</span>
          </div>
          <div className={styles.tokens}>Tokens used: 120</div>
        </header>

        <div className={styles.chatMessages}>
          <div className={styles.messageBot}>
            Hello! How can I assist you today?
            <div className={styles.suggestionBox}>
              <button>Code Review</button>
              <button>Data Analysis</button>
            </div>
          </div>

          <div className={styles.messageUser}>
            Can you help write a Spring Boot API?
          </div>

          <div className={styles.codeBlock}>
            <div className={styles.codeHeader}>
              <span>java</span>
              <button className={styles.copyBtn}>Copy</button>
            </div>
            <pre>
              <code>
                {`@RestController
                  @RequestMapping("/api")
                  public class MyController {
                    @GetMapping("/hello")
                    public String sayHello() {
                      return "Hello from Spring Boot!";
                    }
                  }`
                }
              </code>
            </pre>
          </div>
        </div>

        <footer className={styles.chatInputArea}>
          <div className={styles.actions}>
            <button>📎</button>
            <button>🎤</button>
          </div>
          <input type="text" placeholder="Ask me anything..." />
          <button className={styles.sendBtn}>Send</button>
        </footer>
      </main>

      {/* Right Sidebar */}
      <aside className={styles.sidebarRight}>
        <div className={styles.userSection}>
          <span className={styles.bell}>🔔</span>
          <span className={styles.user}>
            {user?.email || "Unknown User"}
          </span>
        </div>

        <button onClick={handleLogout} className={styles.newChat}>
          Logout
        </button>

        <div className={styles.section}>
          <h3>AI Performance</h3>
          <label>Response Time</label>
          <progress value="80" max="100" />
          <label>Accuracy</label>
          <progress value="90" max="100" />
          <label>Context Usage</label>
          <progress value="70" max="100" />
        </div>

        <div className={styles.section}>
          <h3>AI Tools</h3>
          <ul>
            <li>Document Analysis</li>
            <li>Image Generator</li>
            <li>Code Explainer</li>
          </ul>
        </div>

        <div className={styles.section}>
          <h3>Recent Files</h3>
          <ul>
            <li>component.jsx — analyzed</li>
            <li>schema.sql — 1h ago</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
