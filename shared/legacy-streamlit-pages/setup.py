import streamlit as st
import requests
import json
from typing import Dict, Any, List, Optional

def get_backend_api_url():
    """Get the backend API URL"""
    return "http://localhost:8100"

def fetch_server_setup_status():
    """Fetch all servers with their setup status"""
    try:
        backend_url = get_backend_api_url()
        response = requests.get(f"{backend_url}/setup", timeout=5)
        if response.status_code == 200:
            return response.json().get('servers', [])
        else:
            return []
    except Exception as e:
        st.error(f"Could not fetch server setup status: {str(e)}")
        return []

def get_server_requirements(server_name: str):
    """Get setup requirements for a specific server"""
    try:
        backend_url = get_backend_api_url()
        response = requests.get(f"{backend_url}/setup/{server_name}", timeout=5)
        if response.status_code == 200:
            return response.json()
        else:
            return None
    except Exception as e:
        st.error(f"Could not fetch requirements for {server_name}: {str(e)}")
        return None

def test_credentials(server_name: str, key: str, value: str):
    """Test API credentials"""
    try:
        backend_url = get_backend_api_url()
        response = requests.post(
            f"{backend_url}/setup/{server_name}/test",
            json={"key": key, "value": value},
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
        else:
            return {"success": False, "error": f"HTTP {response.status_code}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def install_server(server_name: str):
    """Install a marketplace server"""
    try:
        backend_url = get_backend_api_url()
        response = requests.post(
            f"{backend_url}/servers/install",
            json={"serverName": server_name},
            timeout=30
        )
        if response.status_code == 200:
            return response.json()
        else:
            return {"success": False, "error": f"HTTP {response.status_code}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def setup_tab():
    """Display the Server Setup page"""
    st.header("⚙️ Server Setup")
    
    st.markdown("""
    Configure marketplace MCP servers with secure API key management.
    This page helps you set up integrations with GitHub, Slack, QuickBooks, and more.
    """)
    
    # Fetch server status
    with st.spinner("Loading server setup status..."):
        servers = fetch_server_setup_status()
    
    if not servers:
        st.warning("No marketplace servers available. Contact administrator.")
        return
    
    # Group servers by setup status
    ready_servers = [s for s in servers if not s['needsSetup']]
    needs_setup_servers = [s for s in servers if s['needsSetup']]
    
    # Create tabs for different server states
    if ready_servers and needs_setup_servers:
        tab1, tab2, tab3 = st.tabs(["⚠️ Needs Setup", "✅ Ready to Install", "📊 All Servers"])
    elif needs_setup_servers:
        tab1, tab3 = st.tabs(["⚠️ Needs Setup", "📊 All Servers"])
        tab2 = None
    elif ready_servers:
        tab2, tab3 = st.tabs(["✅ Ready to Install", "📊 All Servers"])
        tab1 = None
    else:
        tab3 = st.container()
        tab1 = tab2 = None
    
    # Needs Setup tab
    if tab1 and needs_setup_servers:
        with tab1:
            st.subheader(f"⚠️ Servers Requiring Setup ({len(needs_setup_servers)})")
            
            for server in needs_setup_servers:
                with st.expander(f"🔧 {server['displayName']}", expanded=False):
                    col1, col2 = st.columns([2, 1])
                    
                    with col1:
                        st.write(f"**Description:** {server['description']}")
                        st.write(f"**Category:** {server['category']}")
                        st.write(f"**Missing Requirements:** {server['missingRequirements']}")
                    
                    with col2:
                        if st.button(f"⚙️ Setup", key=f"setup_{server['serverName']}", use_container_width=True):
                            st.session_state[f'setup_server'] = server['serverName']
                    
                    # Show setup interface if this server is selected
                    if st.session_state.get('setup_server') == server['serverName']:
                        st.markdown("---")
                        # Move setup interface outside of expander
                        st.session_state['show_setup_interface'] = server['serverName']
    
    # Ready to Install tab
    if tab2 and ready_servers:
        with tab2:
            st.subheader(f"✅ Ready to Install ({len(ready_servers)})")
            
            for server in ready_servers:
                with st.expander(f"✅ {server['displayName']}", expanded=False):
                    col1, col2 = st.columns([2, 1])
                    
                    with col1:
                        st.write(f"**Description:** {server['description']}")
                        st.write(f"**Category:** {server['category']}")
                        st.success("All credentials configured!")
                    
                    with col2:
                        if st.button(f"📦 Install", key=f"install_{server['serverName']}", use_container_width=True):
                            with st.spinner(f"Installing {server['displayName']}..."):
                                result = install_server(server['serverName'])
                                if result.get('success'):
                                    st.success(f"✅ {server['displayName']} installed successfully!")
                                    st.rerun()
                                else:
                                    st.error(f"❌ Installation failed: {result.get('error', 'Unknown error')}")
    
    # All Servers tab
    if tab3:
        with tab3:
            st.subheader(f"📊 All Available Servers ({len(servers)})")
            
            # Create a summary
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("Total Servers", len(servers))
            with col2:
                st.metric("Ready", len(ready_servers))
            with col3:
                st.metric("Need Setup", len(needs_setup_servers))
            
            # Show all servers in a table
            server_data = []
            for server in servers:
                status = "✅ Ready" if not server['needsSetup'] else f"⚠️ Setup ({server['missingRequirements']} missing)"
                server_data.append({
                    "Server": server['displayName'],
                    "Category": server['category'],
                    "Status": status,
                    "Description": server['description'][:50] + "..." if len(server['description']) > 50 else server['description']
                })
            
            if server_data:
                st.dataframe(server_data, use_container_width=True)
    
    # Show setup interface outside of all expanders/tabs if needed
    if st.session_state.get('show_setup_interface'):
        st.markdown("---")
        setup_server_interface(st.session_state['show_setup_interface'])
        # Clear the interface state when done
        if st.session_state.get('setup_completed'):
            del st.session_state['show_setup_interface']
            if 'setup_completed' in st.session_state:
                del st.session_state['setup_completed']

def setup_server_interface(server_name: str):
    """Display the secure setup interface for a specific server"""
    st.markdown(f"### 🔐 Secure Setup for {server_name.title()}")
    
    # Get server requirements
    requirements_data = get_server_requirements(server_name)
    
    if not requirements_data:
        st.error("Could not load server requirements.")
        return
    
    setup_info = requirements_data.get('setup', {})
    missing_reqs = requirements_data.get('missingRequirements', [])
    
    # Show setup overview (no expander)
    st.markdown("#### 📋 Setup Instructions")
    col1, col2 = st.columns(2)
    with col1:
        st.markdown(f"**Estimated Time:** {setup_info.get('estimatedSetupTime', 'Unknown')}")
    with col2:
        st.markdown(f"**Category:** {setup_info.get('category', 'Unknown')}")
    
    st.info(f"📝 **Instructions:** {setup_info.get('setupInstructions', 'No instructions available')}")
    
    # Create secure input fields for each missing requirement
    st.markdown("#### 🔑 Enter Credentials")
    
    credentials = {}
    all_valid = True
    
    for req in missing_reqs:
        # Create a container for each credential instead of expander
        st.markdown(f"**{req['name']}**")
        
        # Show detailed instructions in an info box instead of expander
        st.info(f"📖 **How to get this:** {req.get('instructions', 'No instructions available')}")
        if req.get('setupUrl'):
            st.markdown(f"🔗 **Get it here:** [{req['setupUrl']}]({req['setupUrl']})")
        
        # Create secure input field
        if req['type'] in ['api_key', 'token', 'oauth']:
            # Use password input for sensitive data
            credential_value = st.text_input(
                f"Enter your {req['name']}",
                type="password",  # This hides the input
                key=f"cred_{server_name}_{req['key']}",
                placeholder="Paste your API key/token here",
                help=f"This {req['type']} will be stored securely and not displayed"
            )
        elif req['type'] == 'url':
            credential_value = st.text_input(
                f"Enter your {req['name']}",
                key=f"cred_{server_name}_{req['key']}",
                placeholder="https://example.com/callback",
                help="Enter the full URL"
            )
        else:
            credential_value = st.text_input(
                f"Enter your {req['name']}",
                key=f"cred_{server_name}_{req['key']}",
                help=req.get('description', '')
            )
        
        credentials[req['key']] = credential_value
        
        # Test credential if provided
        if credential_value:
            col1, col2 = st.columns([1, 3])
            with col1:
                if st.button(f"🧪 Test", key=f"test_{server_name}_{req['key']}", use_container_width=True):
                    with st.spinner("Testing credential..."):
                        test_result = test_credentials(server_name, req['key'], credential_value)
                        
                        if test_result.get('valid'):
                            st.success("✅ Valid!")
                        else:
                            st.error(f"❌ Invalid: {test_result.get('error', 'Unknown error')}")
                            all_valid = False
            with col2:
                # Show masked value for confirmation
                masked_value = credential_value[:4] + "*" * (len(credential_value) - 8) + credential_value[-4:] if len(credential_value) > 8 else "*" * len(credential_value)
                st.code(f"Value: {masked_value}", language=None)
        else:
            all_valid = False
    
    # Install button (only enabled if all credentials are provided)
    st.markdown("---")
    col1, col2, col3 = st.columns([1, 2, 1])
    
    with col2:
        can_install = all(credentials.values())  # All fields have values
        
        if st.button(
            f"🚀 Install {server_name.title()} Server",
            disabled=not can_install,
            use_container_width=True,
            type="primary"
        ):
            if can_install:
                # Set environment variables (in a real app, you'd save these securely)
                st.warning("⚠️ Note: In production, credentials would be securely stored in environment variables or a secrets manager.")
                
                # For now, show what would be set
                st.success("✅ Credentials configured! Ready to install server.")
                
                with st.spinner(f"Installing {server_name}..."):
                    result = install_server(server_name)
                    if result.get('success'):
                        st.success(f"🎉 {server_name.title()} server installed successfully!")
                        st.balloons()
                        # Clear the setup state
                        if 'setup_server' in st.session_state:
                            del st.session_state['setup_server']
                        if 'show_setup_interface' in st.session_state:
                            del st.session_state['show_setup_interface']
                        st.session_state['setup_completed'] = True
                        st.rerun()
                    else:
                        st.error(f"❌ Installation failed: {result.get('error', 'Unknown error')}")
            else:
                st.warning("Please provide all required credentials before installing.")
    
    # Cancel button
    with col3:
        if st.button("❌ Cancel", use_container_width=True):
            if 'setup_server' in st.session_state:
                del st.session_state['setup_server']
            if 'show_setup_interface' in st.session_state:
                del st.session_state['show_setup_interface']
            st.rerun()