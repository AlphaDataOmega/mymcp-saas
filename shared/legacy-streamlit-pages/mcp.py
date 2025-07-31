import streamlit as st
import requests
import json
import os
import glob
import re
from typing import Dict, Any, List, Optional

def get_mcp_server_url():
    """Get the local MCP server URL"""
    return "http://localhost:8100/mcp"

def get_backend_api_url():
    """Get the backend API URL"""
    return "http://localhost:8100"

def generate_mcp_config_for_ide(ide_type, mcp_url):
    """Generate simplified MCP configuration for different IDEs"""
    if ide_type == "Windsurf":
        return {
            "mcpServers": {
                "mymcp": {
                    "command": "curl",
                    "args": [mcp_url]
                }
            }
        }
    elif ide_type == "Cursor":
        return f"Connect to: {mcp_url}"
    elif ide_type == "Cline/Roo Code":
        return {
            "mcpServers": {
                "mymcp": {
                    "url": mcp_url
                }
            }
        }
    elif ide_type == "Claude Code":
        return f"claude mcp add MyMCP {mcp_url}"
    else:
        return f"Connect your IDE to: {mcp_url}"

def fetch_installed_servers():
    """Fetch installed marketplace servers from backend"""
    try:
        backend_url = get_backend_api_url()
        response = requests.get(f"{backend_url}/servers", timeout=5)
        if response.status_code == 200:
            servers_data = response.json().get('servers', [])
            return [server for server in servers_data if server.get('status') in ['running', 'stopped']]
        else:
            return []
    except Exception as e:
        st.error(f"Could not fetch installed servers: {str(e)}")
        return []

def fetch_available_tools():
    """Fetch available tools from the backend API and categorize them"""
    try:
        backend_url = get_backend_api_url()
        response = requests.get(f"{backend_url}/tools", timeout=5)
        if response.status_code == 200:
            all_tools = response.json().get('tools', [])
            
            # Separate agent tools from other backend tools
            agent_tools = []
            backend_tools = []
            
            for tool in all_tools:
                if tool['name'].startswith('agent_'):
                    agent_tools.append(tool)
                else:
                    backend_tools.append(tool)
            
            return backend_tools, agent_tools
        else:
            return [], []
    except Exception as e:
        st.error(f"Could not fetch tools from backend: {str(e)}")
        return [], []

def fetch_recorder_tools():
    """Fetch tools saved by the recorder from agent-resources/tools directory"""
    recorder_tools = []
    
    # Get the current directory (streamlit_pages) and navigate to agent-resources/tools
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    tools_dir = os.path.join(parent_dir, "agent-resources", "tools")
    
    if not os.path.exists(tools_dir):
        return recorder_tools
    
    # Find all Python files in the tools directory
    tool_files = glob.glob(os.path.join(tools_dir, "*.py"))
    
    for tool_file in tool_files:
        try:
            with open(tool_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Extract tool metadata if it exists
            metadata_match = re.search(r'TOOL_METADATA\s*=\s*\{([^}]+)\}', content, re.DOTALL)
            
            if metadata_match:
                # This is a recorder-generated tool with metadata
                try:
                    # Extract metadata values
                    name_match = re.search(r'"name":\s*"([^"]+)"', metadata_match.group(0))
                    desc_match = re.search(r'"description":\s*"([^"]+)"', metadata_match.group(0))
                    session_match = re.search(r'"recording_session_id":\s*"([^"]+)"', metadata_match.group(0))
                    
                    tool_name = name_match.group(1) if name_match else os.path.basename(tool_file)[:-3]
                    tool_desc = desc_match.group(1) if desc_match else "Browser automation tool generated from recording"
                    session_id = session_match.group(1) if session_match else "unknown"
                    
                    recorder_tools.append({
                        'name': tool_name,
                        'description': tool_desc,
                        'source': 'recorder',
                        'session_id': session_id,
                        'file_path': tool_file,
                        'filename': os.path.basename(tool_file)
                    })
                except Exception as e:
                    # If parsing metadata fails, add as basic tool
                    tool_name = os.path.basename(tool_file)[:-3]
                    recorder_tools.append({
                        'name': tool_name,
                        'description': f"Browser automation tool ({tool_name})",
                        'source': 'recorder',
                        'session_id': 'unknown',
                        'file_path': tool_file,
                        'filename': os.path.basename(tool_file)
                    })
            else:
                # This is a regular tool file without recorder metadata
                # Extract description from docstring if available
                docstring_match = re.search(r'"""([^"]+)"""', content)
                tool_name = os.path.basename(tool_file)[:-3]
                tool_desc = docstring_match.group(1).strip() if docstring_match else f"Tool from {tool_name}.py"
                
                recorder_tools.append({
                    'name': tool_name,
                    'description': tool_desc,
                    'source': 'agent-resources',
                    'session_id': None,
                    'file_path': tool_file,
                    'filename': os.path.basename(tool_file)
                })
                
        except Exception as e:
            continue  # Skip files that can't be read
    
    return recorder_tools

def mcp_tab():
    """Display the Tools page with MCP server info and available tools"""
    st.header("🔧 Tools & MCP Server")
    
    # MCP Server Information
    st.subheader("📡 MCP Server URL")
    mcp_url = get_mcp_server_url()
    
    col1, col2 = st.columns([3, 1])
    with col1:
        st.code(mcp_url, language="text")
    with col2:
        if st.button("📋 Copy URL", use_container_width=True):
            st.toast("URL copied to clipboard!", icon="✅")
    
    st.info("💡 Use this URL to connect external MCP clients like Claude Desktop, Cursor, or other AI agents to access your tools.")
    
    # Available Tools Section
    st.subheader("🛠️ Available Tools")
    
    with st.spinner("Loading available tools..."):
        backend_tools, agent_tools = fetch_available_tools()
        recorder_tools = fetch_recorder_tools()
        installed_servers = fetch_installed_servers()
    
    total_tools = len(backend_tools) + len(agent_tools) + len(recorder_tools)
    
    if total_tools > 0 or installed_servers:
        st.success(f"Found {total_tools} available tools ({len(backend_tools)} backend, {len(agent_tools)} agents, {len(recorder_tools)} local) + {len(installed_servers)} installed servers")
        
        # Create tabs for different tool sources
        tabs_to_create = ["🔀 All Tools"]
        if installed_servers:
            tabs_to_create.append("📦 Installed Servers")
        if backend_tools:
            tabs_to_create.append("🖥️ Backend Tools")
        if agent_tools:
            tabs_to_create.append("🤖 Agents")
        if recorder_tools:
            tabs_to_create.append("🎬 Local Tools")
        
        tabs = st.tabs(tabs_to_create)
        
        # Map tabs to variables for easier access
        tab_all = tabs[0]
        
        # Find the installed servers tab index
        servers_tab_index = None
        if "📦 Installed Servers" in tabs_to_create:
            servers_tab_index = tabs_to_create.index("📦 Installed Servers")
        tab_servers = tabs[servers_tab_index] if servers_tab_index is not None else None
        
        # Find the backend tab index
        backend_tab_index = None
        if "🖥️ Backend Tools" in tabs_to_create:
            backend_tab_index = tabs_to_create.index("🖥️ Backend Tools")
        tab_backend = tabs[backend_tab_index] if backend_tab_index is not None else None
        
        # Find the agent tab index
        agent_tab_index = None
        if "🤖 Agents" in tabs_to_create:
            agent_tab_index = tabs_to_create.index("🤖 Agents")
        tab_agents = tabs[agent_tab_index] if agent_tab_index is not None else None
        
        # Find the local tab index  
        local_tab_index = None
        if "🎬 Local Tools" in tabs_to_create:
            local_tab_index = tabs_to_create.index("🎬 Local Tools")
        tab_local = tabs[local_tab_index] if local_tab_index is not None else None
        
        # All Tools tab
        with tab_all:
            # Display Backend Tools
            if backend_tools:
                for tool in backend_tools:
                    with st.expander(f"🖥️ {tool['name']}", expanded=False):
                        col1, col2 = st.columns([3, 1])
                        with col1:
                            st.write("**Description:**")
                            st.write(tool.get('description', 'No description available'))
                        with col2:
                            st.markdown("🖥️ **Backend**")
                        
                        if 'inputSchema' in tool and tool['inputSchema'].get('properties'):
                            st.write("**Parameters:**")
                            for param_name, param_info in tool['inputSchema']['properties'].items():
                                param_type = param_info.get('type', 'unknown')
                                param_desc = param_info.get('description', 'No description')
                                required = param_name in tool['inputSchema'].get('required', [])
                                required_badge = "🔴 Required" if required else "🟡 Optional"
                                st.write(f"- `{param_name}` ({param_type}) - {param_desc} {required_badge}")
            
            # Display Agent Tools
            if agent_tools:
                for tool in agent_tools:
                    with st.expander(f"🤖 {tool['name'].replace('agent_', '').title()}", expanded=False):
                        col1, col2 = st.columns([3, 1])
                        with col1:
                            st.write("**Description:**")
                            st.write(tool.get('description', 'No description available'))
                        with col2:
                            st.markdown("🤖 **Agent**")
                        
                        if 'inputSchema' in tool and tool['inputSchema'].get('properties'):
                            st.write("**Parameters:**")
                            for param_name, param_info in tool['inputSchema']['properties'].items():
                                param_type = param_info.get('type', 'unknown')
                                param_desc = param_info.get('description', 'No description')
                                required = param_name in tool['inputSchema'].get('required', [])
                                required_badge = "🔴 Required" if required else "🟡 Optional"
                                st.write(f"- `{param_name}` ({param_type}) - {param_desc} {required_badge}")
            
            # Display Recorder Tools
            if recorder_tools:
                for tool in recorder_tools:
                    
                    with st.expander(f"🎬 {tool['name']}", expanded=False):
                        col1, col2 = st.columns([3, 1])
                        with col1:
                            st.write("**Description:**")
                            st.write(tool['description'])
                        with col2:
                            if tool['source'] == 'recorder':
                                st.markdown("🎬 **Recorder**")
                            else:
                                st.markdown("📁 **Local**")
                        
                        # Show additional info for recorder tools
                        if tool.get('session_id'):
                            st.write(f"**Recording Session:** `{tool['session_id']}`")
                        
                        st.write(f"**File:** `{tool['filename']}`")
                        
                        # Add download button for the tool file
                        try:
                            with open(tool['file_path'], 'r', encoding='utf-8') as f:
                                file_content = f.read()
                            st.download_button(
                                label="📥 Download Tool",
                                data=file_content,
                                file_name=tool['filename'],
                                mime="text/x-python",
                                key=f"download_{tool['filename']}"
                            )
                        except Exception as e:
                            st.error(f"Could not load file: {str(e)}")
        
        # Installed Servers tab
        if tab_servers and installed_servers:
            with tab_servers:
                st.markdown("### 📦 Installed Marketplace Servers")
                
                for server in installed_servers:
                    server_name = server.get('name', 'Unknown Server')
                    server_status = server.get('status', 'unknown')
                    server_tools = server.get('tools', [])
                    
                    # Status emoji
                    status_emoji = "🟢" if server_status == "running" else "🔴" if server_status == "stopped" else "🟡"
                    
                    with st.expander(f"📦 {server_name} {status_emoji} {server_status.title()}", expanded=False):
                        col1, col2 = st.columns([3, 1])
                        
                        with col1:
                            st.write(f"**Status:** {server_status.title()}")
                            st.write(f"**Server ID:** `{server.get('id', 'unknown')}`") 
                            
                            if server.get('installedAt'):
                                install_date = server['installedAt'][:10] if len(server['installedAt']) > 10 else server['installedAt']
                                st.write(f"**Installed:** {install_date}")
                        
                        with col2:
                            # Server control buttons
                            if server_status == "stopped":
                                if st.button(f"▶️ Start", key=f"start_{server['id']}", use_container_width=True):
                                    try:
                                        response = requests.post(f"{get_backend_api_url()}/servers/{server['id']}/start", timeout=10)
                                        if response.status_code == 200:
                                            st.success("Server started!")
                                            st.rerun()
                                        else:
                                            st.error("Failed to start server")
                                    except Exception as e:
                                        st.error(f"Error: {e}")
                            
                            elif server_status == "running":
                                if st.button(f"⏹️ Stop", key=f"stop_{server['id']}", use_container_width=True):
                                    try:
                                        response = requests.post(f"{get_backend_api_url()}/servers/{server['id']}/stop", timeout=10)
                                        if response.status_code == 200:
                                            st.success("Server stopped!")
                                            st.rerun()
                                        else:
                                            st.error("Failed to stop server")
                                    except Exception as e:
                                        st.error(f"Error: {e}")
                        
                        # Show available tools from this server
                        if server_tools:
                            st.write("**Available Tools:**")
                            for i, tool in enumerate(server_tools, 1):
                                st.write(f"  {i}. 🛠️ `{tool}`")
                        else:
                            st.write("**Tools:** No tools available")
                        
                        # Server info
                        if server.get('command'):
                            st.write(f"**Command:** `{server['command']} {' '.join(server.get('args', []))}`")
        
        # Backend Tools tab
        if tab_backend and backend_tools:
            with tab_backend:
                for tool in backend_tools:
                    with st.expander(f"🖥️ {tool['name']}", expanded=False):
                        st.write("**Description:**")
                        st.write(tool.get('description', 'No description available'))
                        
                        if 'inputSchema' in tool and tool['inputSchema'].get('properties'):
                            st.write("**Parameters:**")
                            for param_name, param_info in tool['inputSchema']['properties'].items():
                                param_type = param_info.get('type', 'unknown')
                                param_desc = param_info.get('description', 'No description')
                                required = param_name in tool['inputSchema'].get('required', [])
                                required_badge = "🔴 Required" if required else "🟡 Optional"
                                st.write(f"- `{param_name}` ({param_type}) - {param_desc} {required_badge}")
        
        # Agents tab
        if tab_agents and agent_tools:
            with tab_agents:
                for tool in agent_tools:
                    # Clean up the agent name for display
                    agent_name = tool['name'].replace('agent_', '').replace('_', ' ').title()
                    with st.expander(f"🤖 {agent_name}", expanded=False):
                        col1, col2 = st.columns([3, 1])
                        with col1:
                            st.write("**Description:**")
                            st.write(tool.get('description', 'No description available'))
                        with col2:
                            st.markdown("🤖 **Agent**")
                        
                        # Show the actual tool name for technical reference
                        st.write(f"**Tool Name:** `{tool['name']}`")
                        
                        if 'inputSchema' in tool and tool['inputSchema'].get('properties'):
                            st.write("**Parameters:**")
                            for param_name, param_info in tool['inputSchema']['properties'].items():
                                param_type = param_info.get('type', 'unknown')
                                param_desc = param_info.get('description', 'No description')
                                required = param_name in tool['inputSchema'].get('required', [])
                                required_badge = "🔴 Required" if required else "🟡 Optional"
                                st.write(f"- `{param_name}` ({param_type}) - {param_desc} {required_badge}")
        
        # Local Tools tab
        if tab_local and recorder_tools:
            with tab_local:
                for tool in recorder_tools:
                    
                    with st.expander(f"🎬 {tool['name']}", expanded=False):
                        st.write("**Description:**")
                        st.write(tool['description'])
                        
                        # Show additional info
                        if tool.get('session_id'):
                            st.write(f"**Recording Session:** `{tool['session_id']}`")
                        
                        st.write(f"**Source:** {'🎬 Recorder' if tool['source'] == 'recorder' else '📁 Local'}")
                        st.write(f"**File:** `{tool['filename']}`")
                        
                        # Add download button for the tool file
                        try:
                            with open(tool['file_path'], 'r', encoding='utf-8') as f:
                                file_content = f.read()
                            st.download_button(
                                label="📥 Download Tool",
                                data=file_content,
                                file_name=tool['filename'],
                                mime="text/x-python",
                                key=f"download_local_{tool['filename']}"
                            )
                        except Exception as e:
                            st.error(f"Could not load file: {str(e)}")
    else:
        st.warning("No tools available. Make sure the backend server is running or use the Recorder to create browser automation tools.")
    
    st.markdown("---")
    
    # Legacy MCP IDE Configuration (collapsed by default)
    with st.expander("🔧 IDE Integration Setup", expanded=False):
        st.write("Configure MyMCP.me with your AI IDE:")
        
        # IDE selection with side-by-side buttons
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            windsurf_button = st.button("Windsurf", use_container_width=True, key="windsurf_button")
        with col2:
            cursor_button = st.button("Cursor", use_container_width=True, key="cursor_button")
        with col3:
            cline_button = st.button("Cline/Roo Code", use_container_width=True, key="cline_button")
        with col4:
            claude_button = st.button("Claude Code", use_container_width=True, key="claude_button")
        
        # Initialize session state for selected IDE if not present
        if "selected_ide" not in st.session_state:
            st.session_state.selected_ide = None
        
        # Update selected IDE based on button clicks
        if windsurf_button:
            st.session_state.selected_ide = "Windsurf"
        elif cursor_button:
            st.session_state.selected_ide = "Cursor"
        elif cline_button:
            st.session_state.selected_ide = "Cline/Roo Code"
        elif claude_button:
            st.session_state.selected_ide = "Claude Code"
        
        # Display configuration if an IDE is selected
        if st.session_state.selected_ide:
            st.info("⚠️ Legacy IDE integration - Use the MCP URL above for direct integration instead.")
            selected_ide = st.session_state.selected_ide
            st.subheader(f"MCP Configuration for {selected_ide}")
            
            # For legacy support - point to the new MCP URL
            mcp_server_config = f'"{mcp_url}"'
            
            st.markdown("### New Simplified Configuration")
            st.code(mcp_server_config, language="text")
            st.info("💡 Use this URL directly in your MCP client configuration instead of the complex setup below.")
            
            # Generate IDE-specific configuration
            ide_config = generate_mcp_config_for_ide(selected_ide, mcp_url)
            
            st.markdown("### IDE-Specific Configuration")
            if isinstance(ide_config, dict):
                st.code(json.dumps(ide_config, indent=2), language="json")
            else:
                st.code(ide_config, language="text")
                
            st.markdown("### Quick Setup")
            if selected_ide == "Claude Code":
                st.markdown("Run this command in your terminal:")
                st.code(ide_config, language="bash")
            else:
                st.markdown(f"Add the configuration above to your {selected_ide} MCP settings.")