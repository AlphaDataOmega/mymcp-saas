"""
This module contains the CSS styles for the Streamlit UI.
"""

import streamlit as st

def load_css():
    """
    Load the custom CSS styles for the MyMCP.me UI.
    """
    st.markdown("""
        <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap');
        
        :root {
            --primary-color: #6366f1;  /* Indigo */
            --secondary-color: #8b5cf6; /* Purple */
            --accent-color: #06b6d4;   /* Cyan */
            --success-color: #10b981;  /* Emerald */
            --warning-color: #f59e0b;  /* Amber */
            --danger-color: #ef4444;   /* Red */
            --text-color: #e5e7eb;     /* Light gray */
            --bg-dark: #0f172a;        /* Dark slate */
            --bg-card: #1e293b;        /* Slate 800 */
            --border-color: #334155;   /* Slate 600 */
            --glow-primary: 0 0 20px rgba(99, 102, 241, 0.3);
            --glow-secondary: 0 0 20px rgba(139, 92, 246, 0.3);
        }
        
        /* Global background and text */
        .stApp {
            background: linear-gradient(135deg, var(--bg-dark) 0%, #1e1b4b 100%);
            color: var(--text-color);
            font-family: 'Inter', sans-serif;
        }
        
        /* Sidebar styling */
        .css-1d391kg {
            background: linear-gradient(180deg, var(--bg-card) 0%, var(--bg-dark) 100%);
            border-right: 1px solid var(--border-color);
        }
        
        /* Cool gradient buttons */
        .stButton > button {
            background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            font-weight: 600;
            font-family: 'Inter', sans-serif;
            border-radius: 0.75rem;
            transition: all 0.3s ease;
            box-shadow: 0 4px 14px 0 rgba(99, 102, 241, 0.3);
            position: relative;
            overflow: hidden;
        }
        
        .stButton > button::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transition: left 0.5s;
        }
        
        .stButton > button:hover {
            transform: translateY(-2px);
            box-shadow: var(--glow-primary);
        }
        
        .stButton > button:hover::before {
            left: 100%;
        }
        
        /* Focus states */
        .stButton > button:focus, 
        .stButton > button:focus:hover, 
        .stButton > button:active, 
        .stButton > button:active:hover {
            color: white !important;
            box-shadow: var(--glow-secondary) !important;
            outline: none !important;
            transform: translateY(-2px);
        }
        
        /* Stylish headers with gradients */
        h1, h2, h3 {
            background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            font-family: 'Inter', sans-serif;
            font-weight: 700;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        /* Hide spans within headers */
        h1 span, h2 span, h3 span {
            display: none !important;
            visibility: hidden;
            width: 0;
            height: 0;
            opacity: 0;
            position: absolute;
            overflow: hidden;
        }
        
        /* Code blocks with neon glow */
        pre {
            background: var(--bg-card) !important;
            border: 1px solid var(--border-color) !important;
            border-left: 4px solid var(--accent-color) !important;
            border-radius: 0.5rem;
            font-family: 'JetBrains Mono', monospace !important;
            box-shadow: 0 0 10px rgba(6, 182, 212, 0.2);
        }
        
        code {
            font-family: 'JetBrains Mono', monospace !important;
            background: var(--bg-card) !important;
            color: var(--accent-color) !important;
            padding: 0.2rem 0.4rem;
            border-radius: 0.25rem;
        }
        
        /* Glowing links */
        a {
            color: var(--accent-color);
            text-decoration: none;
            transition: all 0.3s ease;
        }
        
        a:hover {
            color: var(--secondary-color);
            text-shadow: 0 0 8px rgba(139, 92, 246, 0.6);
        }
        
        /* Chat messages with cool styling */
        .stChatMessage {
            background: rgba(30, 41, 59, 0.5) !important;
            border: 1px solid var(--border-color) !important;
            border-left: 4px solid var(--secondary-color) !important;
            border-radius: 0.75rem;
            backdrop-filter: blur(10px);
        }
        
        /* Enhanced chat input */
        .stChatInput > div {
            background: var(--bg-card) !important;
            border: 2px solid var(--border-color) !important;
            border-radius: 1rem !important;
            transition: all 0.3s ease;
        }
        
        .stChatInput > div:focus-within {
            box-shadow: var(--glow-primary) !important;
            border: 2px solid var(--primary-color) !important;
            outline: none !important;
        }
        
        /* Input field enhancements */
        input, textarea, [contenteditable] {
            background: var(--bg-card) !important;
            color: var(--text-color) !important;
            border: 1px solid var(--border-color) !important;
            border-radius: 0.5rem;
            transition: all 0.3s ease;
        }
        
        input:focus, textarea:focus, [contenteditable]:focus {
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1) !important;
            border-color: var(--primary-color) !important;
            outline: none !important;
        }
        
        /* Metric cards with glow effect */
        [data-testid="metric-container"] {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 0.75rem;
            padding: 1rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
        }
        
        [data-testid="metric-container"]:hover {
            box-shadow: var(--glow-primary);
            transform: translateY(-2px);
        }
        
        /* Success/Error messages */
        .stSuccess {
            background: rgba(16, 185, 129, 0.1) !important;
            border: 1px solid var(--success-color) !important;
            color: var(--success-color) !important;
        }
        
        .stError {
            background: rgba(239, 68, 68, 0.1) !important;
            border: 1px solid var(--danger-color) !important;
            color: var(--danger-color) !important;
        }
        
        .stWarning {
            background: rgba(245, 158, 11, 0.1) !important;
            border: 1px solid var(--warning-color) !important;
            color: var(--warning-color) !important;
        }
        
        /* Scrollbar styling */
        ::-webkit-scrollbar {
            width: 8px;
        }
        
        ::-webkit-scrollbar-track {
            background: var(--bg-dark);
        }
        
        ::-webkit-scrollbar-thumb {
            background: var(--border-color);
            border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
            background: var(--primary-color);
        }
        </style>
    """, unsafe_allow_html=True)
