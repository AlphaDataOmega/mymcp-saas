import streamlit as st
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.utils import get_env_var

@st.cache_data
def load_sql_template():
    """Load the SQL template file and cache it"""
    with open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "utils", "site_pages.sql"), "r") as f:
        return f.read()

@st.cache_data
def load_marketplace_sql_template():
    """Load the marketplace SQL template file and cache it"""
    # Go up two levels from streamlit_pages to get to project root, then to database folder
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    schema_path = os.path.join(project_root, "database", "marketplace_schema.sql")
    with open(schema_path, "r") as f:
        return f.read()

def get_supabase_sql_editor_url(supabase_url):
    """Get the URL for the Supabase SQL Editor"""
    try:
        # Extract the project reference from the URL
        # Format is typically: https://<project-ref>.supabase.co
        if '//' in supabase_url and 'supabase' in supabase_url:
            parts = supabase_url.split('//')
            if len(parts) > 1:
                domain_parts = parts[1].split('.')
                if len(domain_parts) > 0:
                    project_ref = domain_parts[0]
                    return f"https://supabase.com/dashboard/project/{project_ref}/sql/new"
        
        # Fallback to a generic URL
        return "https://supabase.com/dashboard"
    except Exception:
        return "https://supabase.com/dashboard"

def show_manual_sql_instructions(sql, vector_dim, recreate=False):
    """Show instructions for manually executing SQL in Supabase"""
    st.info("### Manual SQL Execution Instructions")
    
    # Provide a link to the Supabase SQL Editor
    supabase_url = get_env_var("SUPABASE_URL")
    if supabase_url:
        dashboard_url = get_supabase_sql_editor_url(supabase_url)
        st.markdown(f"**Step 1:** [Open Your Supabase SQL Editor with this URL]({dashboard_url})")
    else:
        st.markdown("**Step 1:** Open your Supabase Dashboard and navigate to the SQL Editor")
    
    st.markdown("**Step 2:** Create a new SQL query")
    
    if recreate:
        st.markdown("**Step 3:** Copy and execute the following SQL:")
        drop_sql = f"DROP FUNCTION IF EXISTS match_site_pages(vector({vector_dim}), int, jsonb);\nDROP TABLE IF EXISTS site_pages CASCADE;"
        st.code(drop_sql, language="sql")
        
        st.markdown("**Step 4:** Then copy and execute this SQL:")
        st.code(sql, language="sql")
    else:
        st.markdown("**Step 3:** Copy and execute the following SQL:")
        st.code(sql, language="sql")
    
    st.success("After executing the SQL, return to this page and refresh to see the updated table status.")

def check_marketplace_tables(supabase):
    """Check if marketplace tables exist in the database"""
    if not supabase:
        return False
    
    required_tables = ['marketplace_servers', 'user_server_installations', 'server_reviews', 'server_content_pages', 'crawl_sessions']
    
    try:
        for table in required_tables:
            # Try to query each table to see if it exists
            supabase.table(table).select("*").limit(1).execute()
        return True
    except Exception:
        return False

def show_marketplace_table_stats(supabase):
    """Show statistics about marketplace tables"""
    if not supabase:
        return
    
    try:
        # Get counts for each table
        servers_count = supabase.table("marketplace_servers").select("*", count="exact").execute().count
        installations_count = supabase.table("user_server_installations").select("*", count="exact").execute().count
        reviews_count = supabase.table("server_reviews").select("*", count="exact").execute().count
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.metric("Total Servers", servers_count or 0)
        
        with col2:
            st.metric("Total Installations", installations_count or 0)
        
        with col3:
            st.metric("Total Reviews", reviews_count or 0)
            
        # Show sample servers if any exist
        if servers_count and servers_count > 0:
            st.write("### Sample Servers")
            servers_response = supabase.table("marketplace_servers").select("name, category, description").limit(5).execute()
            if servers_response.data:
                for server in servers_response.data:
                    with st.expander(f"🔧 {server['name']} ({server.get('category', 'Unknown')})"):
                        st.write(server.get('description', 'No description available.'))
    except Exception as e:
        st.error(f"Error fetching marketplace statistics: {str(e)}")

def database_tab(supabase):
    """Display the database configuration interface"""
    st.header("Database Configuration")
    st.write("Set up and manage your Supabase database tables for MyMCP.me platform.")
    
    # Check if Supabase is configured
    if not supabase:
        st.error("Supabase is not configured. Please set your Supabase URL and Service Key in the Environment tab.")
        return
    
    # Site Pages Table Setup
    st.subheader("Site Pages Table")
    st.write("This table stores web page content and embeddings for semantic search.")
    
    # Add information about the table
    with st.expander("About the Site Pages Table", expanded=False):
        st.markdown("""
        This table is used to store:
        - Web page content split into chunks
        - Vector embeddings for semantic search
        - Metadata for filtering results
        
        The table includes:
        - URL and chunk number (unique together)
        - Title and summary of the content
        - Full text content
        - Vector embeddings for similarity search
        - Metadata in JSON format
        
        It also creates:
        - A vector similarity search function
        - Appropriate indexes for performance
        - Row-level security policies for Supabase
        """)
    
    # Check if the table already exists
    table_exists = False
    table_has_data = False
    
    try:
        # Try to query the table to see if it exists
        response = supabase.table("site_pages").select("id").limit(1).execute()
        table_exists = True
        
        # Check if the table has data
        count_response = supabase.table("site_pages").select("*", count="exact").execute()
        row_count = count_response.count if hasattr(count_response, 'count') else 0
        table_has_data = row_count > 0
        
        st.success("✅ The site_pages table already exists in your database.")
        if table_has_data:
            st.info(f"The table contains data ({row_count} rows).")
        else:
            st.info("The table exists but contains no data.")
    except Exception as e:
        error_str = str(e)
        if "relation" in error_str and "does not exist" in error_str:
            st.info("The site_pages table does not exist yet. You can create it below.")
        else:
            st.error(f"Error checking table status: {error_str}")
            st.info("Proceeding with the assumption that the table needs to be created.")
        table_exists = False
    
    # Vector dimensions selection
    st.write("### Vector Dimensions")
    st.write("Select the embedding dimensions based on your embedding model:")
    
    vector_dim = st.selectbox(
        "Embedding Dimensions",
        options=[1536, 768, 384, 1024],
        index=0,
        help="Use 1536 for OpenAI embeddings, 768 for nomic-embed-text with Ollama, or select another dimension based on your model."
    )
    
    # Get the SQL with the selected vector dimensions
    sql_template = load_sql_template()
    
    # Replace the vector dimensions in the SQL
    sql = sql_template.replace("vector(1536)", f"vector({vector_dim})")
    
    # Also update the match_site_pages function dimensions
    sql = sql.replace("query_embedding vector(1536)", f"query_embedding vector({vector_dim})")
    
    # Show the SQL
    with st.expander("View SQL", expanded=False):
        st.code(sql, language="sql")
    
    # Create table button
    if not table_exists:
        if st.button("Get Instructions for Creating Site Pages Table"):
            show_manual_sql_instructions(sql, vector_dim)
    else:
        # Option to recreate the table or clear data
        col1, col2 = st.columns(2)
        
        with col1:
            st.warning("⚠️ Recreating will delete all existing data.")
            if st.button("Get Instructions for Recreating Site Pages Table"):
                show_manual_sql_instructions(sql, vector_dim, recreate=True)
        
        with col2:
            if table_has_data:
                st.warning("⚠️ Clear all data but keep structure.")
                if st.button("Clear Table Data"):
                    try:
                        with st.spinner("Clearing table data..."):
                            # Use the Supabase client to delete all rows
                            response = supabase.table("site_pages").delete().neq("id", 0).execute()
                            st.success("✅ Table data cleared successfully!")
                            st.rerun()
                    except Exception as e:
                        st.error(f"Error clearing table data: {str(e)}")
                        # Fall back to manual SQL
                        truncate_sql = "TRUNCATE TABLE site_pages;"
                        st.code(truncate_sql, language="sql")
                        st.info("Execute this SQL in your Supabase SQL Editor to clear the table data.")
                        
                        # Provide a link to the Supabase SQL Editor
                        supabase_url = get_env_var("SUPABASE_URL")
                        if supabase_url:
                            dashboard_url = get_supabase_sql_editor_url(supabase_url)
                            st.markdown(f"[Open Your Supabase SQL Editor with this URL]({dashboard_url})")
    
    # Marketplace Tables Setup
    st.subheader("🏪 Marketplace Tables")
    st.write("Set up database tables for the MCP Marketplace functionality.")
    
    # Check if marketplace tables exist
    marketplace_tables_exist = check_marketplace_tables(supabase)
    
    with st.expander("About the Marketplace Tables", expanded=False):
        st.markdown("""
        The marketplace functionality requires several additional tables:
        
        **marketplace_servers**: Stores information about discoverable MCP servers
        - Server metadata (name, description, repository URL)
        - Installation commands and Docker images
        - Tool schemas and examples
        - Statistics and ratings
        
        **user_server_installations**: Tracks what users have installed
        - Installation status and configuration
        - User-specific settings and API keys
        
        **server_reviews**: User reviews and ratings for servers
        
        **server_content_pages**: SEO-friendly content pages for each server
        
        **crawl_sessions**: Logs of discovery crawl sessions
        """)
    
    if not marketplace_tables_exist:
        st.info("Marketplace tables do not exist yet. Click below to get setup instructions.")
        if st.button("Get Instructions for Creating Marketplace Tables"):
            marketplace_sql = load_marketplace_sql_template()
            show_manual_sql_instructions(marketplace_sql, vector_dim=None, recreate=False)
    else:
        st.success("✅ Marketplace tables are already set up.")
        
        # Show marketplace table stats
        show_marketplace_table_stats(supabase)    