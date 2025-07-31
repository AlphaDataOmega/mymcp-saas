import streamlit as st
import sys
import os
import requests
import uuid
from datetime import datetime
from typing import Optional, Dict, List

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.utils import get_env_var

# Backend API configuration
BACKEND_API_URL = "http://localhost:8100"

def get_or_create_user_id() -> str:
    """Get or create a UUID-based user ID for the current session"""
    if 'user_id' not in st.session_state:
        st.session_state.user_id = str(uuid.uuid4())
    return st.session_state.user_id

def get_installed_servers(supabase) -> List[Dict]:
    """Get list of servers installed by the current user"""
    if not supabase:
        return []
    
    try:
        user_id = get_or_create_user_id()
        
        response = supabase.table("user_server_installations")\
            .select("*, marketplace_servers(*)")\
            .eq("user_id", user_id)\
            .eq("status", "installed")\
            .execute()
        
        return response.data or []
    except Exception as e:
        st.error(f"Error fetching installed servers: {str(e)}")
        return []

def get_available_servers(supabase) -> List[Dict]:
    """Get list of all available servers from marketplace"""
    if not supabase:
        st.error("Supabase client not available")
        return []
    
    try:
        response = supabase.table("marketplace_servers")\
            .select("*")\
            .eq("status", "active")\
            .order("featured", desc=True)\
            .order("name")\
            .execute()
        
        return response.data or []
    except Exception as e:
        st.error(f"Error fetching available servers: {str(e)}")
        return []

def get_server_seo_pages(server_id: str, supabase) -> List[Dict]:
    """Get SEO content pages for a server"""
    if not supabase:
        return []
    
    try:
        response = supabase.table("server_content_pages")\
            .select("*")\
            .eq("server_id", server_id)\
            .eq("published", True)\
            .order("page_type")\
            .execute()
        
        return response.data or []
    except Exception as e:
        st.error(f"Error fetching SEO pages: {str(e)}")
        return []

def install_server(server_id: str, supabase) -> bool:
    """Install a server for the current user with backend integration"""
    if not supabase:
        return False
    
    try:
        import requests
        
        user_id = get_or_create_user_id()
        
        # Check if already installed
        existing = supabase.table("user_server_installations")\
            .select("id")\
            .eq("user_id", user_id)\
            .eq("server_id", server_id)\
            .execute()
        
        if existing.data:
            st.warning("Server is already installed!")
            return False
        
        # Get server details to find the server name
        server_data = supabase.table("marketplace_servers")\
            .select("*")\
            .eq("id", server_id)\
            .execute()
        
        if not server_data.data:
            st.error("Server not found in marketplace")
            return False
        
        server = server_data.data[0]
        server_name = server.get('server_key', server.get('name', '').lower().replace(' ', '-'))
        
        # Check setup requirements first
        try:
            setup_response = requests.get(f"http://localhost:8100/setup/{server_name}", timeout=5)
            if setup_response.status_code == 200:
                setup_info = setup_response.json()
                
                # Check if server needs setup and doesn't have credentials
                if setup_info.get('requirements'):
                    st.warning(f"⚙️ **Setup Required**: {server['name']} needs configuration before installation.")
                    st.info("💡 Please visit the **Setup** page to configure API keys and credentials first.")
                    
                    # Show setup requirements
                    with st.expander("📋 Setup Requirements", expanded=True):
                        for req in setup_info['requirements']:
                            st.write(f"• **{req.get('name', 'Unknown')}**: {req.get('description', 'No description')}")
                    
                    return False
        except requests.RequestException:
            # If setup check fails, continue with installation (server may not need setup)
            pass
        
        # Install server via backend (creates MCP agent)
        try:
            install_response = requests.post(
                "http://localhost:8100/servers/install",
                json={"serverName": server_name},
                timeout=30
            )
            
            if install_response.status_code != 200:
                error_data = install_response.json() if install_response.headers.get('content-type') == 'application/json' else {}
                st.error(f"❌ Failed to install server: {error_data.get('error', 'Unknown backend error')}")
                return False
            
            backend_result = install_response.json()
            backend_server_id = backend_result.get('serverId')
            
        except requests.RequestException as e:
            st.error(f"❌ Cannot connect to backend: {str(e)}. Make sure the backend is running.")
            return False
        
        # If backend installation successful, create database record
        result = supabase.table("user_server_installations").insert({
            "user_id": user_id,
            "server_id": server_id,
            "status": "installed",
            "config": {
                "backend_server_id": backend_server_id,  # Link to backend server
                "server_name": server_name,
                "installed_as_agent": True
            }
        }).execute()
        
        if result.data:
            st.success(f"✅ Successfully installed **{server['name']}** as MCP agent!")
            st.info("💡 The server and its tools are now available in the Tools page.")
            return True
        else:
            st.error("❌ Failed to create installation record")
            return False
        
    except Exception as e:
        st.error(f"Error installing server: {str(e)}")
        return False

def is_server_installed(server_id: str, supabase) -> bool:
    """Check if a server is already installed by the current user"""
    if not supabase:
        return False
    
    try:
        user_id = get_or_create_user_id()
        existing = supabase.table("user_server_installations")\
            .select("id")\
            .eq("user_id", user_id)\
            .eq("server_id", server_id)\
            .eq("status", "installed")\
            .execute()
        return bool(existing.data)
    except:
        return False

def show_server_card(server: Dict, supabase, is_installed: bool = False):
    """Display a server card with installation button and SEO links"""
    with st.container():
        col1, col2, col3 = st.columns([1, 3, 1])
        
        with col1:
            # Show logo or placeholder
            if server.get('logo_url'):
                st.image(server['logo_url'], width=60)
            else:
                st.write("🔧")
        
        with col2:
            st.subheader(server['name'])
            st.write(server.get('description', 'No description available.'))
            
            # Show category and tags
            category = server.get('category', 'Unknown')
            st.caption(f"Category: {category}")
            
            if server.get('tags'):
                tags = ", ".join(server['tags'][:3])  # Show first 3 tags
                st.caption(f"Tags: {tags}")
            
            # Add SEO page links
            seo_pages = get_server_seo_pages(server['id'], supabase)
            if seo_pages:
                st.write("📄 **Documentation:**")
                doc_cols = st.columns(len(seo_pages))
                for i, page in enumerate(seo_pages):
                    with doc_cols[i]:
                        if st.button(f"{page['page_type'].title()}", key=f"seo_{server['id']}_{page['page_type']}", use_container_width=True):
                            st.session_state[f"show_page_{server['id']}_{page['page_type']}"] = True
                            st.rerun()
        
        with col3:
            # Check if server is already installed
            already_installed = is_server_installed(server['id'], supabase)
            
            if already_installed:
                st.success("✅ Installed")
            else:
                if st.button(f"Install", key=f"install_{server['id']}"):
                    return server['id']
    
    # Show SEO content if requested
    for page_type in ['overview', 'setup', 'api-reference']:
        show_key = f"show_page_{server['id']}_{page_type}"
        if st.session_state.get(show_key, False):
            seo_page = next((p for p in seo_pages if p['page_type'] == page_type), None)
            if seo_page:
                with st.expander(f"📖 {seo_page['title']}", expanded=True):
                    st.markdown(seo_page['content'])
                    if st.button("Close", key=f"close_{server['id']}_{page_type}"):
                        st.session_state[show_key] = False
                        st.rerun()
    
    st.divider()
    return None

def browse_servers_tab(supabase):
    """Browse all available servers"""
    st.header("🏪 Browse MCP Servers")
    
    # Search and filter options
    col1, col2 = st.columns([3, 1])
    
    with col1:
        search_term = st.text_input("Search servers...", placeholder="Type to search by name or description")
    
    with col2:
        category_filter = st.selectbox("Category", ["All", "development", "communication", "database", "search", "finance"])
    
    # Get available servers
    servers = get_available_servers(supabase)
    
    if not servers:
        st.info("No servers available yet. The marketplace tables may need to be set up in the Database tab.")
        return
    
    # Filter servers based on search and category
    filtered_servers = servers
    
    if search_term:
        filtered_servers = [s for s in filtered_servers 
                          if search_term.lower() in s['name'].lower() 
                          or search_term.lower() in s.get('description', '').lower()]
    
    if category_filter != "All":
        filtered_servers = [s for s in filtered_servers if s.get('category') == category_filter]
    
    st.write(f"Found {len(filtered_servers)} servers")
    
    # Display servers
    for server in filtered_servers:
        server_to_install = show_server_card(server, supabase)
        if server_to_install:
            with st.spinner("Installing server..."):
                if install_server(server_to_install, supabase):
                    st.success(f"Successfully installed {server['name']}!")
                    st.rerun()

def installed_servers_tab(supabase):
    """Show installed servers"""
    st.header("🔧 Your Installed Servers")
    
    installed = get_installed_servers(supabase)
    
    if not installed:
        st.info("You haven't installed any servers yet. Browse the marketplace to find servers to install.")
        return
    
    st.write(f"You have {len(installed)} servers installed")
    
    for installation in installed:
        server = installation.get('marketplace_servers', {})
        if server:
            with st.expander(f"🔧 {server['name']}", expanded=False):
                col1, col2 = st.columns([2, 1])
                
                with col1:
                    st.write(server.get('description', 'No description available.'))
                    st.caption(f"Installed: {installation.get('installed_at', 'Unknown')}")
                    
                    # Show tools if available
                    if server.get('tools'):
                        st.write("**Available Tools:**")
                        tools = server['tools']
                        if isinstance(tools, list):
                            for tool in tools[:5]:  # Show first 5 tools
                                if isinstance(tool, dict):
                                    st.write(f"• {tool.get('name', 'Unknown tool')}")
                                else:
                                    st.write(f"• {tool}")
                
                with col2:
                    st.write("**Status:**")
                    status = installation.get('status', 'unknown')
                    if status == 'installed':
                        st.success("✅ Active")
                    else:
                        st.warning(f"⚠️ {status.title()}")
                    
                    if st.button("Uninstall", key=f"uninstall_{server['id']}"):
                        # TODO: Implement uninstall functionality
                        st.warning("Uninstall functionality coming soon!")

def server_detail_tab(supabase):
    """Show detailed server information"""
    st.header("📖 Server Details")
    
    # Server selection
    servers = get_available_servers(supabase)
    if not servers:
        st.info("No servers available to view details.")
        return
    
    server_names = [f"{s['name']} ({s.get('category', 'Unknown')})" for s in servers]
    selected_idx = st.selectbox("Select a server", range(len(server_names)), format_func=lambda x: server_names[x])
    
    if selected_idx is not None:
        server = servers[selected_idx]
        
        # Server header
        col1, col2 = st.columns([1, 4])
        
        with col1:
            if server.get('logo_url'):
                st.image(server['logo_url'], width=100)
            else:
                st.write("🔧")
        
        with col2:
            st.title(server['name'])
            st.write(server.get('description', 'No description available.'))
            
            if server.get('repository_url'):
                st.markdown(f"[View on GitHub]({server['repository_url']})")
        
        # Show SEO content pages if available
        seo_pages = get_server_seo_pages(server['id'], supabase)
        if seo_pages:
            st.subheader("📄 Documentation Pages")
            cols = st.columns(len(seo_pages))
            for i, page in enumerate(seo_pages):
                with cols[i]:
                    if st.button(f"📖 {page['page_type'].title()}", key=f"seo_{page['id']}"):
                        st.session_state[f"show_seo_{server['id']}"] = page['page_type']
        
        # Check if we should show SEO content
        show_seo_key = f"show_seo_{server['id']}"
        if show_seo_key in st.session_state:
            page_type = st.session_state[show_seo_key]
            seo_page = next((p for p in seo_pages if p['page_type'] == page_type), None)
            if seo_page:
                st.markdown("---")
                st.subheader(f"📖 {seo_page['title']}")
                st.markdown(seo_page['content'])
                if st.button("← Back to Server Details", key=f"back_{server['id']}"):
                    del st.session_state[show_seo_key]
                    st.rerun()
                return
        
        # Tabs for different sections
        detail_tab = st.selectbox("", ["Overview", "Installation", "Tools", "Examples"])
        
        if detail_tab == "Overview":
            col1, col2 = st.columns(2)
            
            with col1:
                st.subheader("Information")
                st.write(f"**Category:** {server.get('category', 'Unknown')}")
                st.write(f"**Author:** {server.get('author', 'Unknown')}")
                st.write(f"**License:** {server.get('license', 'Unknown')}")
                st.write(f"**Version:** {server.get('version', 'Unknown')}")
                
                if server.get('tags'):
                    st.write(f"**Tags:** {', '.join(server['tags'])}")
            
            with col2:
                st.subheader("Statistics")
                # TODO: Add real statistics
                st.metric("Downloads", "N/A")
                st.metric("Rating", "N/A")
                st.metric("Reviews", "N/A")
        
        elif detail_tab == "Installation":
            st.subheader("Installation Instructions")
            
            if server.get('install_command'):
                st.code(server['install_command'], language="bash")
            
            if server.get('docker_image'):
                st.write("**Docker:**")
                st.code(f"docker run {server['docker_image']}", language="bash")
            
            # One-click install button
            if st.button("Install Server", key=f"detail_install_{server['id']}"):
                with st.spinner("Installing..."):
                    if install_server(server['id'], supabase):
                        st.success("Server installed successfully!")
        
        elif detail_tab == "Tools":
            st.subheader("Available Tools")
            
            if server.get('tools'):
                tools = server['tools']
                if isinstance(tools, list):
                    for tool in tools:
                        if isinstance(tool, dict):
                            with st.expander(f"🔧 {tool.get('name', 'Unknown tool')}"):
                                st.write(tool.get('description', 'No description available.'))
                                
                                # Show parameters if available
                                if tool.get('parameters'):
                                    st.write("**Parameters:**")
                                    st.json(tool['parameters'])
                else:
                    st.write(tools)
            else:
                st.info("No tool information available yet.")
        
        elif detail_tab == "Examples":
            st.subheader("Usage Examples")
            
            if server.get('examples'):
                examples = server['examples']
                if isinstance(examples, list):
                    for i, example in enumerate(examples):
                        st.write(f"**Example {i+1}:**")
                        if isinstance(example, dict):
                            st.write(example.get('description', ''))
                            if example.get('code'):
                                st.code(example['code'], language="python")
                        else:
                            st.code(example, language="python")
                else:
                    st.write(examples)
            else:
                st.info("No examples available yet.")

def marketplace_tab(supabase):
    """Main marketplace interface"""
    # Initialize user session with proper UUID
    user_id = get_or_create_user_id()
    
    # Sub-navigation
    tab_option = st.selectbox(
        "Choose marketplace section:",
        ["Browse Servers", "Your Installed Servers", "Server Details"],
        key="marketplace_tab_selection"
    )
    
    if tab_option == "Browse Servers":
        browse_servers_tab(supabase)
    elif tab_option == "Your Installed Servers":
        installed_servers_tab(supabase)
    elif tab_option == "Server Details":
        server_detail_tab(supabase)