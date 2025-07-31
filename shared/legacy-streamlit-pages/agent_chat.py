import streamlit as st
import requests
import json
from typing import Dict, Any, List

def get_backend_api_url():
    """Get the backend API URL"""
    return "http://localhost:8100"

def call_mcp_tool(tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Call an MCP tool through the backend API"""
    try:
        backend_url = get_backend_api_url()
        response = requests.post(
            f"{backend_url}/tools/{tool_name}/execute",
            json={"arguments": arguments},
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            return {
                "success": False,
                "error": f"HTTP {response.status_code}: {response.text}"
            }
    except Exception as e:
        return {
            "success": False,
            "error": f"Request failed: {str(e)}"
        }

def get_available_tools() -> List[Dict[str, Any]]:
    """Get list of available MCP tools"""
    try:
        backend_url = get_backend_api_url()
        response = requests.get(f"{backend_url}/tools", timeout=5)
        if response.status_code == 200:
            return response.json().get('tools', [])
        else:
            return []
    except Exception:
        return []

def parse_tool_request(message: str) -> Dict[str, Any]:
    """Simple parser to extract tool calls from natural language"""
    message_lower = message.lower()
    
    # Navigate tool
    if "navigate" in message_lower or "go to" in message_lower:
        # Extract URL - look for http/https URLs or common domains
        words = message.split()
        url = None
        for word in words:
            if word.startswith(('http://', 'https://')):
                url = word
                break
            elif any(domain in word for domain in ['.com', '.org', '.net', '.gov', '.edu']):
                if not word.startswith('http'):
                    url = f"https://{word}"
                else:
                    url = word
                break
        
        if url:
            return {
                "tool": "browser_navigate",
                "arguments": {"url": url}
            }
    
    # Screenshot tool
    elif "screenshot" in message_lower or "take a picture" in message_lower:
        return {
            "tool": "browser_screenshot",
            "arguments": {}
        }
    
    # Click tool
    elif "click" in message_lower:
        # Extract element text after "click"
        click_idx = message_lower.find("click")
        after_click = message[click_idx + 5:].strip()
        # Remove common words
        element = after_click.replace("on", "").replace("the", "").strip()
        if element:
            return {
                "tool": "browser_click",
                "arguments": {"element": element}
            }
    
    # Type tool
    elif "type" in message_lower or "enter" in message_lower:
        # Extract text to type
        if "type" in message_lower:
            type_idx = message_lower.find("type")
            after_type = message[type_idx + 4:].strip()
            # Look for patterns like 'type "text" in field' or 'type text into field'
            if '"' in after_type:
                text_start = after_type.find('"') + 1
                text_end = after_type.find('"', text_start)
                if text_end > text_start:
                    text = after_type[text_start:text_end]
                    # Find field after the text
                    remaining = after_type[text_end + 1:].strip()
                    if remaining.startswith("in") or remaining.startswith("into"):
                        field = remaining.split(None, 1)[1] if len(remaining.split()) > 1 else "input"
                    else:
                        field = "input"
                    
                    return {
                        "tool": "browser_type",
                        "arguments": {"element": field, "text": text}
                    }
    
    # Snapshot tool
    elif "snapshot" in message_lower or "page content" in message_lower:
        return {
            "tool": "browser_snapshot",
            "arguments": {}
        }
    
    return None

def agent_chat_tab():
    """Display the Agent chat interface with MCP tool execution"""
    st.write("🤖 **Chat with your Agent** - I have access to browser automation tools and can help you navigate the web, take screenshots, click elements, and more!")
    
    # Show available tools in an expander
    with st.expander("🔧 Available Tools", expanded=False):
        tools = get_available_tools()
        if tools:
            for tool in tools:
                st.write(f"**{tool['name']}**: {tool.get('description', 'No description')}")
        else:
            st.warning("No tools available. Make sure the backend is running.")
    
    # Initialize chat history
    if "agent_messages" not in st.session_state:
        st.session_state.agent_messages = []
    
    # Clear conversation button
    col1, col2 = st.columns([1, 4])
    with col1:
        if st.button("Clear Chat"):
            st.session_state.agent_messages = []
            st.rerun()
    
    # Display chat messages
    for message in st.session_state.agent_messages:
        with st.chat_message(message["role"]):
            if message["role"] == "assistant" and "tool_result" in message:
                # Display tool execution result
                st.markdown(message["content"])
                with st.expander("🔧 Tool Execution Details"):
                    st.json(message["tool_result"])
            else:
                st.markdown(message["content"])
    
    # Chat input
    user_input = st.chat_input("Ask me to navigate websites, take screenshots, click buttons, etc.")
    
    if user_input:
        # Add user message
        st.session_state.agent_messages.append({
            "role": "user", 
            "content": user_input
        })
        
        # Display user message
        with st.chat_message("user"):
            st.markdown(user_input)
        
        # Process the request
        with st.chat_message("assistant"):
            with st.spinner("Processing your request..."):
                # Parse the message for tool calls
                tool_request = parse_tool_request(user_input)
                
                if tool_request:
                    # Execute the tool
                    st.write(f"🔧 Executing: **{tool_request['tool']}**")
                    result = call_mcp_tool(tool_request['tool'], tool_request['arguments'])
                    
                    if result.get('success'):
                        response = f"✅ Successfully executed **{tool_request['tool']}**!"
                        if 'message' in result:
                            response += f"\n\n{result['message']}"
                    else:
                        response = f"❌ Failed to execute **{tool_request['tool']}**: {result.get('error', 'Unknown error')}"
                    
                    # Add assistant response with tool result
                    st.session_state.agent_messages.append({
                        "role": "assistant",
                        "content": response,
                        "tool_result": result
                    })
                    
                    st.markdown(response)
                    
                    # Show tool execution details
                    with st.expander("🔧 Tool Execution Details"):
                        st.json(result)
                        
                else:
                    # No tool recognized - provide help
                    response = """I can help you with browser automation! Here are some things you can ask me:

📍 **Navigation**: "Navigate to google.com" or "Go to https://example.com"
📸 **Screenshots**: "Take a screenshot" or "Take a picture of the page"  
🖱️ **Clicking**: "Click the search button" or "Click on login"
⌨️ **Typing**: "Type 'hello world' in the search box"
👁️ **Page Content**: "Show me the page content" or "Take a snapshot"

Try asking me to do one of these actions!"""
                    
                    st.session_state.agent_messages.append({
                        "role": "assistant",
                        "content": response
                    })
                    
                    st.markdown(response)