import streamlit as st
import requests
import json
import time
import zipfile
import io
import os
import re
from typing import Dict, Any, Optional

# Backend API configuration
BACKEND_API_URL = "http://localhost:8100"

def create_extension_zip():
    """Create a zip file of the browser extension with latest built files"""
    extension_path = "/home/ubuntu/mymcpme2/mymcp-me/extension"
    
    # Check if we have a pre-built latest zip
    latest_zip_path = os.path.join(extension_path, "mymcp-extension-latest.zip")
    if os.path.exists(latest_zip_path):
        with open(latest_zip_path, 'rb') as f:
            return f.read()
    
    # Fallback: create zip dynamically
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        # Include essential files only
        essential_files = [
            'manifest.json',
            'popup.html', 
            'connect.html',
            'lib/popup.js',
            'lib/background.js', 
            'lib/connect.js',
            'lib/content.js',
            'lib/relayConnection.js'
        ]
        
        # Add essential files
        for file_name in essential_files:
            file_path = os.path.join(extension_path, file_name)
            if os.path.exists(file_path):
                zip_file.write(file_path, file_name)
        
        # Add icon files
        icons_dir = os.path.join(extension_path, 'icons')
        if os.path.exists(icons_dir):
            for icon_file in os.listdir(icons_dir):
                if icon_file.endswith('.png'):
                    icon_path = os.path.join(icons_dir, icon_file)
                    zip_file.write(icon_path, f'icons/{icon_file}')
    
    zip_buffer.seek(0)
    return zip_buffer.getvalue()

def check_extension_connection():
    """Check if the browser extension is connected and ready"""
    try:
        # Check HTTP API connection status
        response = requests.get(f"{BACKEND_API_URL}/extension/status", timeout=2)
        if response.status_code == 200:
            status_data = response.json()
            api_connected = status_data.get("connected", False)
            websocket_ready = status_data.get("websocketReady", False)
        else:
            api_connected = False
            websocket_ready = False
        
        # For DOM events extension (v2.0.0), HTTP connection is sufficient for recording
        # WebSocket is only needed for browser automation tool execution
        return {
            "api_connected": api_connected,
            "websocket_ready": websocket_ready,
            "fully_connected": api_connected,  # Recording only needs HTTP
            "recording_ready": api_connected,   # New field for recording capability
            "tool_execution_ready": api_connected and websocket_ready  # Tool execution needs both
        }
    except:
        return {
            "api_connected": False,
            "websocket_ready": False,
            "fully_connected": False,
            "recording_ready": False,
            "tool_execution_ready": False
        }

def auto_detect_recent_session():
    """Auto-detect most recent completed session for tool generation"""
    try:
        sessions_response = requests.get(f"{BACKEND_API_URL}/recorder/sessions", timeout=3)
        if sessions_response.status_code == 200:
            sessions_data = sessions_response.json()
            if sessions_data.get('success') and sessions_data.get('sessions'):
                # Find completed sessions with actions
                completed_sessions = [
                    s for s in sessions_data['sessions'] 
                    if s['status'] == 'stopped' and s['actionsCount'] > 0
                ]
                
                if completed_sessions and "last_completed_session" not in st.session_state:
                    # Auto-select the most recent completed session
                    most_recent = completed_sessions[0]  # Assuming newest first
                    st.session_state["last_completed_session"] = most_recent
                    
                    # Show an info message that we found a recent session
                    st.info(f"🎯 Found recent recording: **{most_recent['name']}** ({most_recent['actionsCount']} actions)")
    except Exception:
        pass  # Silently handle errors

def recorder_tab():
    """Browser Action Recorder interface"""
    
    # Check for recent completed sessions and auto-show tool generation
    auto_detect_recent_session()
    
    st.markdown("# 🎬 Browser Action Recorder")
    st.markdown("""
    Record your browser interactions and automatically generate tools for your AI agents!
    
    **🔄 Dual-Purpose Extension:**
    - **🎬 Recording Mode**: Capture your browser actions to create new automation tools
    - **⚡ Playback Mode**: Execute generated tools and browser automation commands
    
    **Complete Workflow:**
    1. **📦 Install Extension**: Download and install the browser extension  
    2. **🔗 Connect Extension**: Establish both HTTP and WebSocket connections
    3. **🎬 Record Actions**: Capture your browser interactions in real-time
    4. **🛠️ Generate Tools**: Convert recordings into reusable MCP tools
    5. **⚡ Use Tools**: Execute tools via AI agents or direct API calls
    """)
    
    # Show architecture overview
    with st.expander("🏗️ Extension Architecture", expanded=False):
        st.markdown("""
        **Extension Connections:**
        - **HTTP Connection**: For recording session management and status updates
        - **WebSocket Connection**: For real-time browser automation and tool execution
        
        **Why Both Connections?**
        - **Recording**: HTTP handles session management, WebSocket captures browser events
        - **Playback**: WebSocket enables real-time tool execution in browser tabs
        
        **Ready When**: Both connections show green ✅ status
        """)
    
    # Check if backend API is available
    try:
        response = requests.get(f"{BACKEND_API_URL}/health", timeout=5)
        api_available = response.status_code == 200
    except:
        api_available = False
    
    if not api_available:
        st.error("🚨 Backend API is not available. Please start the backend server first.")
        st.code("npm start")
        return
    
    # Tabs for different recorder functions
    recorder_tab, sessions_tab, tools_tab = st.tabs(["🎬 Record Actions", "📚 Sessions", "🛠️ Generated Tools"])
    
    with recorder_tab:
        show_recorder_interface()
    
    with sessions_tab:
        show_sessions_interface()
    
    with tools_tab:
        show_tools_interface()

def show_recorder_interface():
    """Main recording interface with browser extension integration"""
    
    # Step 1: Extension Installation Check
    st.markdown("### 🎬 Browser Recording Setup")
    
    # Check if user has extension installed
    with st.expander("📥 Step 1: Install Browser Extension", expanded=True):
        st.markdown("""
        **MyMCP.me requires a browser extension for recording your actions:**
        
        **Option A: Download Latest Extension Zip (Recommended)**
        1. **Download the zip file** using the button below (includes Generate Tool button!)
        2. **Extract the zip** to any folder on your computer  
        3. **Install in Chrome/Edge**: 
           - Open `chrome://extensions/` or `edge://extensions/`
           - Enable "Developer mode" 
           - Click "Load unpacked"
           - Select the extracted extension folder
        4. **Look for the extension icon** in your browser toolbar
        
        **Option B: Use Local Installation**
        - Extension Location: `/home/ubuntu/mymcpme2/mymcp-me/extension/`
        """)
        
        col1, col2 = st.columns(2)
        
        with col1:
            try:
                zip_data = create_extension_zip()
                st.download_button(
                    label="📦 Download Latest Extension.zip",
                    data=zip_data,
                    file_name="mymcp-browser-extension-latest.zip",
                    mime="application/zip",
                    type="primary",
                    help="Downloads the latest extension with Generate Tool button"
                )
                st.success("✅ **Latest Version**: Includes Generate Tool button in popup")
                st.info("🔧 **New Features**: Auto-connect, DOM events recording, session recovery, tool generation & frontend redirect")
            except Exception as e:
                st.error(f"Failed to create extension zip: {str(e)}")
                st.code("Fallback Path: /home/ubuntu/mymcpme2/mymcp-me/extension/")
        
        with col2:
            if st.button("📋 Copy Local Path"):
                st.info("Copy this path: `/home/ubuntu/mymcpme2/mymcp-me/extension/`")
                
        # Extension version diagnostic
        st.markdown("---")
        st.markdown("**🔍 Extension Version Check:**")
        st.markdown("""
        **How to verify you have the latest extension:**
        1. Right-click the extension icon → "Manage extension"
        2. Check version shows **"2.1.0"** (latest with session recovery)
        3. The popup should show **"Generate Tool"** button (not just download)
        4. If you see **"Session not found"** errors, re-download and reinstall the extension
        """)
        
        if st.button("🔄 **I'm getting 'Session not found' errors - Help!**", type="secondary"):
            st.error("**Issue**: You likely have an older extension version that doesn't include session recovery logic.")
            st.success("**Solution**: Download the latest extension using the button above and reinstall it.")
            st.info("**Steps**: 1) Download new zip 2) Extract it 3) Go to chrome://extensions/ 4) Remove old extension 5) Load the new unpacked extension")
    
    # Step 2: Extension Connection  
    # Check current connection status
    connection_status = check_extension_connection()
    is_fully_connected = connection_status["fully_connected"]
    
    with st.expander("🔗 Step 2: Connect Extension", expanded=not connection_status.get("recording_ready", False)):
        if connection_status.get("recording_ready", False):
            st.success("🟢 **Extension is connected and ready for recording!**")
            if connection_status.get("websocket_ready", False):
                st.info("✅ Both recording and tool execution modes are available.")
            else:
                st.info("✅ Recording mode is ready. Tool execution requires additional WebSocket connection.")
        else:
            # Show detailed connection status
            col1, col2 = st.columns(2)
            with col1:
                if connection_status["api_connected"]:
                    st.success("✅ **HTTP Connection**: Connected")
                else:
                    st.error("❌ **HTTP Connection**: Not connected")
            
            with col2:
                if connection_status["websocket_ready"]:
                    st.success("✅ **WebSocket Connection**: Ready")
                else:
                    st.error("❌ **WebSocket Connection**: Not ready")
            
            st.markdown("---")
            
            st.markdown("""
            **Simple Connection Process:**
            
            1. **Click the extension icon** in your browser toolbar (should appear after installing)
            2. **Click "🔗 Connect to MyMCP.me"** in the popup
            3. **Wait for both connections** to establish automatically
            
            The extension will:
            - ✅ Connect to the backend API (HTTP)
            - ✅ Establish WebSocket connection (for real-time automation)
            - ✅ Connect to your current active browser tab
            """)
            
            if connection_status["api_connected"] and not connection_status["websocket_ready"]:
                st.info("ℹ️ **Recording Ready**: HTTP connected. WebSocket is optional for recording-only usage.")
            
            if not connection_status["api_connected"]:
                st.info("💡 **Next Step**: Click the extension icon in your browser toolbar and click 'Connect to MyMCP.me'")
        
        # Connection status indicator
        st.markdown("### 📊 Connection Status")
        status_col1, status_col2, status_col3 = st.columns(3)
        
        with status_col1:
            if connection_status["api_connected"]:
                st.markdown("**API:** 🟢 Connected")
            else:
                st.markdown("**API:** 🔴 Disconnected")
        
        with status_col2:
            if connection_status["websocket_ready"]:
                st.markdown("**WebSocket:** 🟢 Ready")
            else:
                st.markdown("**WebSocket:** 🔴 Not Ready")
                
        with status_col3:
            if is_fully_connected:
                st.markdown("**Overall:** 🟢 Ready")
            else:
                st.markdown("**Overall:** 🔴 Not Ready")
        
        # Refresh button
        if st.button("🔄 Refresh Connection Status", key="refresh_connection"):
            st.rerun()
    
    st.divider()
    
    # Step 3: Recording Controls
    st.markdown("### 📹 Recording Controls")
    
    if not connection_status.get("recording_ready", False):
        st.warning("⚠️ **Extension must be connected before you can start recording.**")
        st.info("Please complete Step 2 above to establish the HTTP connection.")
    
    col1, col2 = st.columns([2, 1])
    
    with col1:
        # Session configuration
        session_name = st.text_input(
            "Session Name",
            placeholder="e.g., 'Login to Gmail', 'Search Products', 'Fill Contact Form'",
            help="Give your recording session a descriptive name",
            disabled=not connection_status.get("recording_ready", False)
        )
        
        session_description = st.text_area(
            "Description (Optional)",
            placeholder="Describe what this automation does and when to use it...",
            help="Optional description that will be included in the generated tool",
            disabled=not connection_status.get("recording_ready", False)
        )
        
        # Recording controls
        col_start, col_stop = st.columns(2)
        
        with col_start:
            start_button_disabled = not connection_status.get("recording_ready", False) or not session_name
            if st.button(
                "🔴 Start Recording", 
                use_container_width=True, 
                type="primary",
                disabled=start_button_disabled
            ):
                if not session_name:
                    st.error("Please enter a session name")
                elif not is_fully_connected:
                    st.error("Extension must be connected first")
                else:
                    start_recording_with_extension(session_name, session_description)
        
        with col_stop:
            if st.button("⏹️ Stop Recording", use_container_width=True):
                stop_recording()
    
    with col2:
        st.markdown("### 📊 Recording Status")
        
        # Show current recording status
        if "recording_session_id" in st.session_state:
            st.success(f"🔴 Recording: {st.session_state.get('recording_session_name', 'Unknown')}")
            st.info(f"Session ID: `{st.session_state['recording_session_id']}`")
            
            # Real-time recording status
            st.markdown("#### 🎬 Recording in Progress")
            st.info("Perform actions in your connected browser tab. Actions will be automatically captured via the browser extension.")
            
            # Show captured actions count if available
            if st.button("🔄 Refresh Status"):
                get_recording_status()
        else:
            st.info("No active recording session")
            st.info("💡 To generate tools from completed recordings, use the **Generated Tools** tab above")
            
            # Fallback for manual testing (temporary)
            with st.expander("🔧 Manual Testing (Fallback)", expanded=False):
                st.warning("For testing purposes only - use extension for real recordings")
                
                action_type = st.selectbox(
                    "Action Type",
                    ["navigate", "click", "type", "wait", "screenshot"],
                    key="action_type_select"
                )
                
                if action_type == "navigate":
                    url = st.text_input("URL to navigate to", placeholder="https://example.com")
                    if st.button("➕ Add Navigate Action") and url:
                        add_manual_action("navigate", {"url": url, "description": f"Navigate to {url}"})
                
                elif action_type == "click":
                    element = st.text_input("Element to click", placeholder="Search button")
                    if st.button("➕ Add Click Action") and element:
                        add_manual_action("click", {"selector": element, "description": f"Click on {element}"})
                
                elif action_type == "type":
                    col_element, col_text = st.columns(2)
                    with col_element:
                        element = st.text_input("Input field", placeholder="Email field")
                    with col_text:
                        text = st.text_input("Text to type", placeholder="user@example.com")
                    if st.button("➕ Add Type Action") and element and text:
                        add_manual_action("type", {"selector": element, "text": text, "description": f"Type '{text}' into {element}"})
                
                elif action_type == "wait":
                    duration = st.number_input("Wait duration (seconds)", min_value=1, max_value=10, value=2)
                    if st.button("➕ Add Wait Action"):
                        add_manual_action("wait", {"description": f"Wait {duration} seconds"})
                
                elif action_type == "screenshot":
                    if st.button("➕ Add Screenshot Action"):
                        add_manual_action("screenshot", {"description": "Take screenshot"})
                
                # Auto-refresh status
                if st.button("🔄 Refresh Status"):
                    st.rerun()
    
    # Test tool execution section
    if is_fully_connected:
        with st.expander("⚡ Test Browser Automation", expanded=False):
            st.markdown("**Test that your extension can execute browser automation tools:**")
            
            col1, col2 = st.columns(2)
            with col1:
                if st.button("📸 Test Screenshot Tool", type="secondary"):
                    try:
                        response = requests.post(
                            f"{BACKEND_API_URL}/tools/browser_screenshot/execute",
                            json={"arguments": {}},
                            timeout=10
                        )
                        
                        if response.status_code == 200:
                            result = response.json()
                            st.success("✅ Screenshot tool executed successfully!")
                            if result.get("result"):
                                st.info(f"Result: {result['result']}")
                        else:
                            st.error(f"❌ Tool execution failed: {response.text}")
                    except Exception as e:
                        st.error(f"❌ Error testing tool: {str(e)}")
            
            with col2:
                if st.button("📄 Test Page Snapshot", type="secondary"):
                    try:
                        response = requests.post(
                            f"{BACKEND_API_URL}/tools/browser_snapshot/execute",
                            json={"arguments": {}},
                            timeout=10
                        )
                        
                        if response.status_code == 200:
                            result = response.json()
                            st.success("✅ Snapshot tool executed successfully!")
                            if result.get("result"):
                                st.info(f"Result: {result['result'][:200]}...")
                        else:
                            st.error(f"❌ Tool execution failed: {response.text}")
                    except Exception as e:
                        st.error(f"❌ Error testing tool: {str(e)}")
    
    # Recording tips
    with st.expander("💡 Recording Tips", expanded=False):
        st.markdown("""
        **For best results:**
        
        ✅ **Good practices:**
        - Use clear, descriptive element identifiers (IDs, unique text)
        - Wait for pages to fully load before interacting
        - Keep actions simple and focused on one workflow
        - Test the recorded actions on the same website
        
        ⚠️ **Limitations:**
        - Works best with consistent website layouts
        - May need manual adjustments for dynamic content
        - Generated tools work with the specific website structure
        - Some complex interactions may not record perfectly
        """)

def show_sessions_interface():
    """Show all recording sessions"""
    
    st.markdown("### 📚 Recorded Sessions")
    
    # Refresh button
    if st.button("🔄 Refresh Sessions"):
        st.rerun()
    
    try:
        response = requests.get(f"{BACKEND_API_URL}/recorder/sessions", timeout=10)
        if response.status_code == 200:
            data = response.json()
            sessions = data.get("sessions", [])
            
            if not sessions:
                st.info("No recording sessions found. Start by recording some browser actions!")
                return
            
            # Display sessions in cards
            for session in sessions:
                with st.container():
                    col1, col2, col3, col4 = st.columns([3, 1, 1, 1])
                    
                    with col1:
                        st.markdown(f"**{session['name']}**")
                        if session.get('description'):
                            st.caption(session['description'])
                        st.caption(f"Actions: {session['actionsCount']} | Status: {session['status']}")
                    
                    with col2:
                        duration = session.get('duration', 0)
                        st.metric("Duration", f"{duration // 1000}s")
                    
                    with col3:
                        if st.button("👁️ View", key=f"view_{session['id']}"):
                            show_session_details(session['id'])
                    
                    with col4:
                        if st.button("🗑️ Delete", key=f"delete_{session['id']}"):
                            delete_session(session['id'])
                    
                    st.divider()
        
        else:
            st.error(f"Failed to fetch sessions: {response.status_code}")
    
    except Exception as e:
        st.error(f"Error fetching sessions: {str(e)}")

def show_tools_interface():
    """Show generated tools"""
    
    # Create tabs for different tool views
    generate_tab, saved_tab = st.tabs(["🔧 Generate New Tool", "💼 Saved Tools"])
    
    with generate_tab:
        st.markdown("### 🔧 Generate New Tool")
        
        # Check if we already have a tool being generated/customized
        active_generation = None
        for key in st.session_state.keys():
            if key.startswith("tool_generation_"):
                active_generation = key.replace("tool_generation_", "")
                break
        
        if active_generation:
            # Show the active tool generation
            generate_tool_code(active_generation)
            
            # Add a button to start over
            if st.button("🔄 Generate Different Tool", type="secondary"):
                # Clear the current generation
                for key in list(st.session_state.keys()):
                    if active_generation in key:
                        del st.session_state[key]
                st.rerun()
        else:
            # Get sessions that can generate tools
            try:
                response = requests.get(f"{BACKEND_API_URL}/recorder/sessions", timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    sessions = [s for s in data.get("sessions", []) if s['status'] in ['stopped', 'completed']]
                    
                    if not sessions:
                        st.info("No completed sessions available for tool generation.")
                        return
                    
                    # Session selector
                    session_options = {f"{s['name']} ({s['actionsCount']} actions)": s['id'] for s in sessions}
                    selected_session = st.selectbox(
                        "Select a session to generate tool from:",
                        options=list(session_options.keys())
                    )
                    
                    if selected_session and st.button("🔧 Generate Tool Code", type="primary"):
                        session_id = session_options[selected_session]
                        generate_tool_code(session_id)
                        st.rerun()  # Refresh to show the generation form
                else:
                    st.error("Failed to fetch sessions for tool generation")
                    
            except Exception as e:
                st.error(f"Error fetching sessions: {str(e)}")
    
    with saved_tab:
        show_saved_tools()

def show_saved_tools():
    """Display saved tools from agent resources"""
    st.markdown("### 💼 Saved Tools")
    
    try:
        # Get the tools directory
        tools_dir = os.path.join(os.path.dirname(__file__), '..', 'agent-resources', 'tools')
        
        if not os.path.exists(tools_dir):
            st.info("No tools directory found. Save a tool first to create it.")
            return
        
        # Find all Python files and their metadata
        tools = []
        for filename in os.listdir(tools_dir):
            if filename.endswith('.py') and not filename.startswith('__'):
                tool_path = os.path.join(tools_dir, filename)
                metadata_path = os.path.join(tools_dir, filename.replace('.py', '_metadata.json'))
                
                # Try to load metadata
                metadata = {}
                if os.path.exists(metadata_path):
                    try:
                        with open(metadata_path, 'r', encoding='utf-8') as f:
                            metadata = json.load(f)
                    except:
                        pass
                
                # If no metadata, create basic info from filename
                if not metadata:
                    metadata = {
                        "name": filename.replace('.py', '').replace('_', ' ').title(),
                        "description": "Browser automation tool",
                        "file_name": filename,
                        "generated_from_recording": False,
                        "type": "unknown"
                    }
                
                tools.append({
                    "path": tool_path,
                    "metadata": metadata
                })
        
        if not tools:
            st.info("No tools found in agent resources. Generate and save a tool first!")
            return
        
        # Display tools in a nice format
        for tool in tools:
            metadata = tool["metadata"]
            
            with st.container():
                col1, col2, col3 = st.columns([3, 1, 1])
                
                with col1:
                    st.markdown(f"**{metadata.get('name', 'Unknown Tool')}**")
                    st.caption(metadata.get('description', 'No description available'))
                    
                    if metadata.get('generated_from_recording'):
                        st.markdown("🎬 **Generated from Recording**")
                    
                    if metadata.get('created_at'):
                        st.caption(f"Created: {metadata['created_at']}")
                
                with col2:
                    # View code button - use session state to track which tool to show
                    view_key = f"view_tool_{metadata['file_name']}"
                    if st.button("👁️ View", key=f"view_{metadata['file_name']}"):
                        if view_key in st.session_state:
                            del st.session_state[view_key]
                        else:
                            st.session_state[view_key] = True
                        st.rerun()
                
                with col3:
                    # Download button
                    try:
                        with open(tool["path"], 'r', encoding='utf-8') as f:
                            code = f.read()
                        
                        st.download_button(
                            label="💾 Download",
                            data=code,
                            file_name=metadata['file_name'],
                            mime="text/python",
                            key=f"download_{metadata['file_name']}"
                        )
                    except Exception as e:
                        st.error(f"Error: {e}")
                
                # Show code if requested
                view_key = f"view_tool_{metadata['file_name']}"
                if st.session_state.get(view_key, False):
                    try:
                        with open(tool["path"], 'r', encoding='utf-8') as f:
                            code = f.read()
                        
                        with st.expander("📄 Tool Code", expanded=True):
                            st.code(code, language="python")
                    except Exception as e:
                        st.error(f"Error reading tool: {e}")
                
                st.divider()
    
    except Exception as e:
        st.error(f"Error loading saved tools: {e}")

def start_recording_with_extension(session_name: str, description: str = ""):
    """Start a new recording session with browser extension integration"""
    try:
        # First, start the recording session on the backend
        response = requests.post(
            f"{BACKEND_API_URL}/recorder/start",
            json={"sessionName": session_name, "description": description},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            st.session_state["recording_session_id"] = data["sessionId"]
            st.session_state["recording_session_name"] = session_name
            st.success(f"✅ {data['message']}")
            
            # Provide instructions for extension-based recording
            st.info("🎬 **Recording started!** Now perform actions in your connected browser tab. The extension will automatically capture:")
            st.markdown("""
            - 🧭 **Navigation** (page changes, URL updates)
            - 🖱️ **Clicks** (buttons, links, form elements) 
            - ⌨️ **Typing** (form inputs, text fields)
            - 📋 **Form interactions** (dropdowns, checkboxes)
            - ⏸️ **Page waits** (loading, delays)
            """)
            
            # Instructions for users
            st.warning("⚠️ **Important**: Make sure your browser extension is connected and active before performing actions!")
            
        else:
            error_data = response.json() if response.headers.get('content-type') == 'application/json' else {"error": response.text}
            st.error(f"❌ Failed to start recording: {error_data.get('error', 'Unknown error')}")
    
    except Exception as e:
        st.error(f"❌ Error starting recording: {str(e)}")

def get_recording_status():
    """Get the current status of the recording session"""
    if "recording_session_id" not in st.session_state:
        return
    
    try:
        session_id = st.session_state["recording_session_id"]
        response = requests.get(f"{BACKEND_API_URL}/recorder/sessions/{session_id}", timeout=5)
        
        if response.status_code == 200:
            session_data = response.json()
            session = session_data.get("session", {})
            actions_count = len(session.get("actions", []))
            
            if actions_count > 0:
                st.success(f"📊 Captured {actions_count} actions so far")
                
                # Show recent actions
                with st.expander("📋 Recent Actions", expanded=False):
                    actions = session.get("actions", [])
                    for i, action in enumerate(actions[-5:], 1):  # Show last 5 actions
                        st.write(f"{i}. **{action['type']}**: {action.get('description', 'No description')}")
            else:
                st.info("No actions captured yet - make sure your extension is connected and active")
        else:
            st.warning(f"Could not fetch recording status: {response.status_code}")
    
    except Exception as e:
        st.error(f"Error getting recording status: {str(e)}")

def start_recording(session_name: str, description: str = ""):
    """Legacy start recording function for backward compatibility"""
    return start_recording_with_extension(session_name, description)

def stop_recording():
    """Stop the current recording session"""
    try:
        response = requests.post(f"{BACKEND_API_URL}/recorder/stop", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            session = data["session"]
            
            # Store completed session info and clear recording state
            st.session_state["last_completed_session"] = session
            if "recording_session_id" in st.session_state:
                del st.session_state["recording_session_id"]
            if "recording_session_name" in st.session_state:
                del st.session_state["recording_session_name"]
            
            st.success(f"✅ Recording stopped: {session['name']}")
            st.info(f"Recorded {session['actionsCount']} actions in {session['duration'] // 1000} seconds")
            
        else:
            st.error(f"Failed to stop recording: {response.json().get('error', 'Unknown error')}")
    
    except Exception as e:
        st.error(f"Error stopping recording: {str(e)}")

def show_session_details(session_id: str):
    """Show detailed information about a session"""
    try:
        response = requests.get(f"{BACKEND_API_URL}/recorder/sessions/{session_id}", timeout=10)
        if response.status_code == 200:
            session = response.json()["session"]
            
            st.markdown(f"### 📋 Session Details: {session['name']}")
            
            col1, col2 = st.columns(2)
            with col1:
                st.metric("Actions", len(session['actions']))
                st.metric("Status", session['status'])
            with col2:
                start_time = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(session['startTime'] / 1000))
                st.metric("Started", start_time)
                if session.get('endTime'):
                    duration = (session['endTime'] - session['startTime']) // 1000
                    st.metric("Duration", f"{duration}s")
            
            # Show actions
            st.markdown("#### 🎯 Recorded Actions")
            for i, action in enumerate(session['actions'], 1):
                with st.expander(f"Action {i}: {action['description']}", expanded=False):
                    st.json(action)
        
        else:
            st.error("Failed to fetch session details")
    
    except Exception as e:
        st.error(f"Error fetching session details: {str(e)}")

def delete_session(session_id: str):
    """Delete a recording session"""
    try:
        response = requests.delete(f"{BACKEND_API_URL}/recorder/sessions/{session_id}", timeout=10)
        if response.status_code == 200:
            st.success("Session deleted successfully")
            st.rerun()
        else:
            st.error("Failed to delete session")
    except Exception as e:
        st.error(f"Error deleting session: {str(e)}")

def save_tool_to_resources(tool_name: str, tool_description: str, tool_code: str, session_id: str) -> bool:
    """Save a generated tool to the MCP system as a registered agent"""
    try:
        # Validate inputs
        if not tool_name or not tool_code or not session_id:
            return False
        
        # Create agent code that wraps the browser automation
        agent_code = f'''"""
{tool_description}

Generated from browser recording session: {session_id}
This agent executes the recorded browser automation workflow.
"""

import asyncio
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel

# Initialize the agent
browser_automation_agent = Agent(
    model=OpenAIModel("gpt-4o-mini"),
    system_prompt="""You are a browser automation agent that executes recorded workflows.
    Your primary function is to execute the browser automation sequence that was recorded."""
)

@browser_automation_agent.tool
async def execute_recorded_workflow() -> str:
    """Execute the recorded browser automation workflow"""
    try:
        import requests
        
        # The recorded workflow execution
        # This is the actual recorded code:
        {tool_code.replace('def ', 'def _original_')}
        
        # Execute the original recorded function
        result = _original_execute_recorded_action()
        return f"Browser automation completed successfully: {{result}}"
        
    except Exception as e:
        return f"Browser automation failed: {{str(e)}}"

# Main execution function for MCP integration
async def run_agent(params: dict = None):
    """Main function to run the browser automation agent"""
    try:
        result = await browser_automation_agent.run("Execute the recorded browser workflow")
        return {{
            "success": True,
            "result": result.data,
            "type": "browser_automation",
            "session_id": "{session_id}"
        }}
    except Exception as e:
        return {{
            "success": False,
            "error": str(e),
            "type": "browser_automation",
            "session_id": "{session_id}"
        }}

# For backward compatibility
def execute_recorded_action():
    """Legacy function name"""
    return asyncio.run(run_agent())
'''
        
        # Register as an agent in the MCP system
        register_payload = {
            "name": tool_name,
            "description": f"{tool_description} (Generated from recording {session_id})",
            "code": agent_code,
            "tools": [f"execute_{tool_name.lower().replace(' ', '_')}_workflow"],
            "metadata": {
                "generated_from_recording": True,
                "recording_session_id": session_id,
                "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                "type": "browser_automation"
            }
        }
        
        # Register with the backend
        response = requests.post(
            f"{BACKEND_API_URL}/agents/register", 
            json=register_payload,
            timeout=30
        )
        
        if response.status_code == 200:
            # Also save locally for backward compatibility
            save_local_copy(tool_name, tool_description, tool_code, session_id)
            return True
        else:
            # Fallback to local save only
            return save_local_copy(tool_name, tool_description, tool_code, session_id)
        
    except Exception as e:
        # Fallback to local save
        return save_local_copy(tool_name, tool_description, tool_code, session_id)

def save_local_copy(tool_name: str, tool_description: str, tool_code: str, session_id: str) -> bool:
    """Save a local copy of the tool for backup and compatibility"""
    try:
        import random
        import string
        
        # Generate random filename
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        clean_name = f"browser_tool_{random_suffix}.py"
        
        # Create enhanced tool code with proper metadata
        enhanced_tool_code = f'''"""
{tool_description}

Generated from browser recording session: {session_id}
Tool Name: {tool_name}
"""

{tool_code}

# Tool metadata for agent integration
TOOL_METADATA = {{
    "name": "{tool_name}",
    "description": "{tool_description}",
    "generated_from_recording": True,
    "recording_session_id": "{session_id}",
    "file_name": "{clean_name}",
    "registered_as_agent": True
}}
'''
        
        # Determine the tools directory path
        tools_dir = os.path.join(os.path.dirname(__file__), '..', 'agent-resources', 'tools')
        os.makedirs(tools_dir, exist_ok=True)
        
        # Write the tool file
        tool_path = os.path.join(tools_dir, clean_name)
        with open(tool_path, 'w', encoding='utf-8') as f:
            f.write(enhanced_tool_code)
        
        # Also create a JSON metadata file
        metadata = {
            "name": tool_name,
            "description": tool_description,
            "file_name": clean_name,
            "generated_from_recording": True,
            "recording_session_id": session_id,
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "type": "browser_automation",
            "registered_as_agent": True
        }
        
        metadata_path = os.path.join(tools_dir, f"{clean_name.replace('.py', '_metadata.json')}")
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)
        
        return True
        
    except Exception as e:
        return False

def generate_tool_code(session_id: str):
    """Generate tool code from a session"""
    try:
        # Store the request in session state to persist across reruns
        if f"tool_generation_{session_id}" not in st.session_state:
            response = requests.post(f"{BACKEND_API_URL}/recorder/sessions/{session_id}/generate-tool", timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                st.session_state[f"tool_generation_{session_id}"] = {
                    "tool_code": data["toolCode"],
                    "generated": True,
                    "tool_name": f"browser_automation_{session_id[:6]}",
                    "tool_description": "Automated browser workflow generated from recorded session"
                }
            else:
                st.error(f"Failed to generate tool: {response.status_code}")
                return
        
        # Check if we have generated tool data
        if f"tool_generation_{session_id}" in st.session_state:
            tool_data = st.session_state[f"tool_generation_{session_id}"]
            tool_code = tool_data["tool_code"]
            
            st.success("✅ Tool code generated successfully!")
            
            # Simple tool customization form with session state
            st.markdown("#### ⚙️ Customize Your Tool")
            
            col1, col2 = st.columns(2)
            
            with col1:
                # Initialize session state values if not present
                name_key = f"tools_tab_tool_name_{session_id}"
                if name_key not in st.session_state:
                    st.session_state[name_key] = tool_data["tool_name"]
                
                tool_name = st.text_input(
                    "Tool Name",
                    value=st.session_state[name_key],
                    help="Name for your tool (will be used as filename)",
                    key=name_key
                )
            
            with col2:
                # Initialize session state values if not present
                desc_key = f"tools_tab_tool_desc_{session_id}"
                if desc_key not in st.session_state:
                    st.session_state[desc_key] = tool_data["tool_description"]
                    
                tool_description = st.text_input(
                    "Tool Description",
                    value=st.session_state[desc_key],
                    help="Description of what this tool does",
                    key=desc_key
                )
            
            # Simple buttons
            st.markdown("**Actions:**")
            col1, col2 = st.columns(2)
            
            with col1:
                # Enhanced download button with content
                enhanced_code = f'''"""
{tool_description}

Generated from browser recording session: {session_id}
Tool Name: {tool_name}
"""

{tool_code}

# Tool metadata for agent integration
TOOL_METADATA = {{
    "name": "{tool_name}",
    "description": "{tool_description}",
    "generated_from_recording": True,
    "recording_session_id": "{session_id}",
}}
'''
                st.download_button(
                    label="📥 Download Tool",
                    data=enhanced_code,
                    file_name=f"{tool_name.lower().replace(' ', '_')}.py",
                    mime="text/x-python",
                    use_container_width=True,
                    key=f"tools_tab_download_{session_id}"
                )
            
            with col2:
                save_button = st.button("💼 Save to Agent Resources", type="primary", use_container_width=True, key=f"tools_tab_save_{session_id}")
            
            # Handle save button outside the column to avoid any layout issues
            if save_button:
                st.balloons()  # Immediate visual feedback that button was clicked
                st.write("🎉 BUTTON CLICKED - PROCESSING...")
                if not tool_name.strip():
                    st.error("❌ Tool name is required!")
                else:
                    # Save locally to keep recorder tools in Local Tools tab
                    save_success = save_tool_to_resources(tool_name, tool_description, tool_code, session_id)
                    if save_success:
                        st.success(f"✅ Tool '{tool_name}' saved successfully!")
                        st.info("💡 Check the Tools page → Local Tools tab to see your saved tool!")
                    else:
                        st.error("❌ Failed to save tool.")
            
            # Show the generated code outside the form
            st.markdown("#### 🐍 Generated Python Tool")
            st.code(tool_code, language="python")
            
            # Usage instructions
            with st.expander("📖 How to use this tool", expanded=True):
                st.markdown("""
                **To use this generated tool:**
                
                1. **Save the code**: Download or copy the generated Python code
                2. **Add to agent resources**: Place the file in your `agent-resources/tools/` directory
                3. **Update agent**: Your AI agents can now use this tool automatically
                4. **Test the tool**: Run the function to make sure it works as expected
                
                **Example usage in agent:**
                ```python
                # The agent can now call this tool automatically
                result = execute_your_recorded_action()
                print(result)
                ```
                """)
            
            # Clear session state and provide action buttons
            st.divider()
            col1, col2 = st.columns(2)
            
            with col1:
                if st.button("🔄 Start New Recording", type="primary", use_container_width=True):
                    # Clear any completed session data to return to main recording interface
                    for key in ["last_completed_session", "selected_session_for_tool"]:
                        if key in st.session_state:
                            del st.session_state[key]
                    st.rerun()
            
            with col2:
                if st.button("📊 View All Sessions", use_container_width=True):
                    # This would typically navigate to a sessions page, but for now just clear current view
                    if "last_completed_session" in st.session_state:
                        del st.session_state["last_completed_session"]
                    st.rerun()
        
        else:
            error_detail = "Unknown error"
            try:
                error_data = response.json()
                error_detail = error_data.get('error', f'HTTP {response.status_code}')
            except:
                error_detail = f"HTTP {response.status_code} - {response.text[:200]}"
            
            st.error(f"Failed to generate tool: {error_detail}")
            
            # Debug information
            with st.expander("🔧 Debug Information", expanded=False):
                st.write(f"Status Code: {response.status_code}")
                st.write(f"Response: {response.text[:500]}")
    
    except requests.exceptions.Timeout:
        st.error("Tool generation timed out. The session may be too large or the backend is overloaded. Please try again.")
    except requests.exceptions.ConnectionError:
        st.error("Could not connect to backend. Please check that the MyMCP.me backend is running.")
    except Exception as e:
        st.error(f"Error generating tool: {str(e)}")
        
        # Debug information for unexpected errors
        with st.expander("🔧 Debug Information", expanded=False):
            st.exception(e)

def add_manual_action(action_type: str, action_data: Dict[str, Any]):
    """Add a manual action to the current recording session"""
    if "recording_session_id" not in st.session_state:
        st.error("No active recording session")
        return
    
    try:
        # Use the existing /recorder/action endpoint
        response = requests.post(
            f"{BACKEND_API_URL}/recorder/action",
            json={
                "type": action_type,
                **action_data
            },
            timeout=10
        )
        
        if response.status_code == 200:
            st.success(f"✅ Added {action_type} action: {action_data.get('description', 'Unknown action')}")
            st.rerun()
        else:
            st.error(f"Failed to add action: {response.json().get('error', 'Unknown error')}")
    
    except Exception as e:
        st.error(f"Error adding action: {str(e)}")