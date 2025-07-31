import streamlit as st

def show_header():
    """Display a cool animated header for MyMCP.me"""
    st.markdown("""
        <div style="text-align: center; padding: 2rem 0; margin-bottom: 2rem;">
            <div style="
                background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                font-size: 3.5rem;
                font-weight: 900;
                font-family: 'Inter', sans-serif;
                margin-bottom: 0.5rem;
                text-shadow: 0 0 40px rgba(99, 102, 241, 0.3);
                animation: glow 2s ease-in-out infinite alternate;
            ">
                MyMCP<span style="color: #06b6d4;">.me</span>
            </div>
            <div style="
                font-size: 1.2rem;
                color: #94a3b8;
                font-weight: 500;
                margin-bottom: 1rem;
                font-family: 'Inter', sans-serif;
            ">
                AI Agent Builder with Advanced Browser Automation
            </div>
            <div style="
                display: flex;
                justify-content: center;
                gap: 1rem;
                flex-wrap: wrap;
                margin-top: 1.5rem;
            ">
                <div style="
                    background: rgba(99, 102, 241, 0.1);
                    border: 1px solid rgba(99, 102, 241, 0.3);
                    padding: 0.5rem 1rem;
                    border-radius: 2rem;
                    color: #6366f1;
                    font-size: 0.875rem;
                    font-weight: 600;
                ">🤖 Agent Generation</div>
                <div style="
                    background: rgba(139, 92, 246, 0.1);
                    border: 1px solid rgba(139, 92, 246, 0.3);
                    padding: 0.5rem 1rem;
                    border-radius: 2rem;
                    color: #8b5cf6;
                    font-size: 0.875rem;
                    font-weight: 600;
                ">🌐 Browser Control</div>
                <div style="
                    background: rgba(6, 182, 212, 0.1);
                    border: 1px solid rgba(6, 182, 212, 0.3);
                    padding: 0.5rem 1rem;
                    border-radius: 2rem;
                    color: #06b6d4;
                    font-size: 0.875rem;
                    font-weight: 600;
                ">🛠️ MCP Integration</div>
            </div>
        </div>
        
        <style>
        @keyframes glow {
            from {
                text-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
            }
            to {
                text-shadow: 0 0 30px rgba(99, 102, 241, 0.6), 0 0 40px rgba(139, 92, 246, 0.3);
            }
        }
        </style>
    """, unsafe_allow_html=True)