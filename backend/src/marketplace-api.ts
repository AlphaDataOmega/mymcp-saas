/**
 * MyMCP.me Marketplace API
 * Bridges marketplace frontend with existing server-manager backend
 */

import { Router, Request, Response } from 'express';
import { serverManager } from './server-manager.js';
import { agentRegistry } from './agent-registry.js';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Lazy-load Supabase client to ensure env vars are loaded
function getSupabaseClient() {
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing required environment variables: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }
  
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

interface InstallMCPRequest {
  mcp_id: string;
  tenant_id: string;
  environment_config?: Record<string, string>;
}

interface MCPCatalogEntry {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
  install_command: string;
  install_args: string[];
  required_env_vars: Array<{
    name: string;
    description: string;
    required: boolean;
    example?: string;
  }>;
  tools_schema: Array<{
    name: string;
    description: string;
    parameters?: any;
  }>;
  download_count?: number;
}

/**
 * GET /api/marketplace/mcps
 * Browse marketplace MCPs with filtering
 */
router.get('/mcps', async (req: Request, res: Response) => {
  try {
    const {
      category,
      search,
      tags,
      sort = 'popularity',
      limit = 20,
      offset = 0
    } = req.query;

    const supabase = getSupabaseClient();
    let query = supabase
      .from('mcp_catalog')
      .select(`
        id, name, slug, display_name, description, category, tags,
        rating, review_count, github_url, install_command,
        required_env_vars, tools_schema, created_at
      `);

    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.textSearch('name,description', String(search));
    }

    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      query = query.overlaps('tags', tagArray);
    }

    // Apply sorting
    switch (sort) {
      case 'rating':
        query = query.order('rating', { ascending: false });
        break;
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'name':
        query = query.order('display_name', { ascending: true });
        break;
      default: // popularity
        query = query.order('popularity_score', { ascending: false });
    }

    // Apply pagination
    query = query.range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data, error, count } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      mcps: data || [],
      total: count || 0,
      has_more: (count || 0) > Number(offset) + Number(limit)
    });

  } catch (error) {
    console.error('Marketplace browse error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/marketplace/mcps/:id
 * Get detailed MCP information
 */
router.get('/mcps/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    const { id } = req.params;

    const { data, error } = await supabase
      .from('mcp_catalog')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'MCP not found' });
    }

    res.json(data);

  } catch (error) {
    console.error('MCP detail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/marketplace/install
 * Install MCP from marketplace to tenant
 */
router.post('/install', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    const { mcp_id, tenant_id, environment_config = {} } = req.body as InstallMCPRequest;

    if (!mcp_id || !tenant_id) {
      return res.status(400).json({ error: 'mcp_id and tenant_id are required' });
    }

    // 1. Get MCP details from marketplace catalog
    const { data: mcpData, error: mcpError } = await supabase
      .from('mcp_catalog')
      .select('*')
      .eq('id', mcp_id)
      .single();

    if (mcpError || !mcpData) {
      return res.status(404).json({ error: 'MCP not found in catalog' });
    }

    const mcp = mcpData as MCPCatalogEntry;

    // 2. Check if already installed for this tenant
    const { data: existingInstallation } = await supabase
      .from('tenant_mcp_installations')
      .select('id, status')
      .eq('tenant_id', tenant_id)
      .eq('mcp_id', mcp_id)
      .single();

    if (existingInstallation) {
      return res.status(409).json({ 
        error: 'MCP already installed',
        installation_id: existingInstallation.id,
        status: existingInstallation.status
      });
    }

    // 3. Validate required environment variables
    const requiredEnvVars = mcp.required_env_vars || [];
    const missingVars = requiredEnvVars
      .filter(envVar => envVar.required && !environment_config[envVar.name])
      .map(envVar => envVar.name);

    if (missingVars.length > 0) {
      return res.status(400).json({
        error: 'Missing required environment variables',
        missing_vars: missingVars,
        required_env_vars: requiredEnvVars
      });
    }

    // 4. Create installation record (pending status)
    const installationId = `${tenant_id}-${mcp.name}-${Date.now()}`;
    
    const { data: installation, error: installError } = await supabase
      .from('tenant_mcp_installations')
      .insert({
        tenant_id,
        mcp_id,
        server_instance_id: installationId,
        status: 'installing',
        installation_config: {
          environment_config,
          install_command: mcp.install_command,
          install_args: mcp.install_args || []
        }
      })
      .select()
      .single();

    if (installError) {
      return res.status(500).json({ error: 'Failed to create installation record' });
    }

    // 5. Install via existing ServerManager (async)
    try {
      // Use existing serverManager singleton
      
      // Build server config for existing install flow
      const serverConfig = {
        name: mcp.name,
        command: mcp.install_command,
        args: mcp.install_args || [],
        env: environment_config,
        tools: (mcp.tools_schema || []).map(tool => tool.name)
      };

      // Install server (this uses your existing logic)
      const actualServerId = await serverManager.installServer(serverConfig);

      if (actualServerId) {
        // 6. Register MCP as agent for tool discovery
        try {
          await agentRegistry.registerAgent({
            name: `mcp_${mcp.name}`,
            description: `MCP Server: ${mcp.description}`,
            code: `# MCP Server Wrapper for ${mcp.name}\n# Installed from marketplace`,
            tools: (mcp.tools_schema || []).map(tool => tool.name),
            metadata: {
              author: 'marketplace',
              version: '1.0.0',
              tags: ['mcp', 'marketplace'],
              requirements: []
            }
          });
        } catch (agentError) {
          console.warn('Failed to register MCP as agent:', agentError);
          // Continue anyway - the server is installed
        }

        // 7. Update installation status with actual server ID
        await supabase
          .from('tenant_mcp_installations')
          .update({ 
            status: 'active',
            server_instance_id: actualServerId,
            last_health_check: new Date().toISOString()
          })
          .eq('id', installation.id);

        // 8. Update download count
        await supabase
          .from('mcp_catalog')
          .update({ 
            download_count: (mcp.download_count || 0) + 1 
          })
          .eq('id', mcp_id);

        res.json({
          success: true,
          installation_id: installation.id,
          server_instance_id: actualServerId,
          status: 'active',
          available_tools: (mcp.tools_schema || []).map(tool => tool.name),
          message: `${mcp.display_name} installed successfully`
        });

      } else {
        // Installation failed
        await supabase
          .from('tenant_mcp_installations')
          .update({ 
            status: 'error',
            error_message: 'Installation failed - no server ID returned'
          })
          .eq('id', installation.id);

        res.status(500).json({
          error: 'Installation failed',
          details: 'No server ID returned',
          installation_id: installation.id
        });
      }

    } catch (installError) {
      console.error('Server installation error:', installError);
      
      // Update status to error
      await supabase
        .from('tenant_mcp_installations')
        .update({ 
          status: 'error',
          error_message: String(installError)
        })
        .eq('id', installation.id);

      res.status(500).json({
        error: 'Installation failed',
        details: String(installError),
        installation_id: installation.id
      });
    }

  } catch (error) {
    console.error('MCP install error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/marketplace/installations/:tenant_id
 * Get all MCP installations for a tenant
 */
router.get('/installations/:tenant_id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    const { tenant_id } = req.params;

    const { data, error } = await supabase
      .from('tenant_mcp_installations')
      .select(`
        *,
        mcp_catalog (
          name, display_name, description, category, 
          tools_schema, required_env_vars
        )
      `)
      .eq('tenant_id', tenant_id)
      .order('installed_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ installations: data || [] });

  } catch (error) {
    console.error('Get installations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/marketplace/installations/:installation_id
 * Uninstall MCP from tenant
 */
router.delete('/installations/:installation_id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    const { installation_id } = req.params;

    // Get installation details
    const { data: installation, error: getError } = await supabase
      .from('tenant_mcp_installations')
      .select('*, mcp_catalog(name)')
      .eq('id', installation_id)
      .single();

    if (getError || !installation) {
      return res.status(404).json({ error: 'Installation not found' });
    }

    // Remove from ServerManager
    await serverManager.uninstallServer(installation.server_instance_id);

    // Remove from AgentRegistry
    await agentRegistry.unregisterAgent(installation.server_instance_id);

    // Remove from database
    const { error: deleteError } = await supabase
      .from('tenant_mcp_installations')
      .delete()
      .eq('id', installation_id);

    if (deleteError) {
      return res.status(500).json({ error: 'Failed to remove installation record' });
    }

    res.json({
      success: true,
      message: `${installation.mcp_catalog?.name} uninstalled successfully`
    });

  } catch (error) {
    console.error('MCP uninstall error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/marketplace/categories
 * Get all MCP categories
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('mcp_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ categories: data || [] });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/marketplace/mcps/:id/reviews
 * Get reviews for a specific MCP
 */
router.get('/mcps/:id/reviews', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    const { id } = req.params;

    const { data, error } = await supabase
      .from('mcp_reviews')
      .select('id, rating, review_text, created_at, status')
      .eq('mcp_id', id)
      .eq('status', 'approved') // Only return approved reviews
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ reviews: data || [] });

  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/marketplace/upload-scraped-data
 * Upload scraped MCP data from the enhanced scraper
 */
router.post('/upload-scraped-data', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    const { mcps, source = 'enhanced_scraper' } = req.body;

    if (!mcps || !Array.isArray(mcps)) {
      return res.status(400).json({ error: 'mcps array is required' });
    }

    console.log(`📦 Uploading ${mcps.length} scraped MCPs to marketplace...`);

    const results = {
      total: mcps.length,
      inserted: 0,
      updated: 0,
      errors: []
    };

    for (const mcp of mcps) {
      try {
        // Generate unique slug
        const slug = mcp.name.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim('-');

        // Check if already exists by slug
        const { data: existing } = await supabase
          .from('mcp_catalog')
          .select('id')
          .eq('slug', slug)
          .single();

        // Map scraped data to database schema (match ALL columns including new verbose ones)
        const mcpData = {
          // Core fields
          name: mcp.name,
          slug,
          display_name: mcp.display_name || mcp.name,
          description: mcp.description,
          long_description: mcp.long_description,
          category: mcp.category,
          github_url: mcp.github_url || mcp.website || `https://github.com/modelcontextprotocol/servers/tree/main/${mcp.github_path}`,
          github_path: mcp.github_path,
          package_name: mcp.package_info?.name,
          version: mcp.package_info?.version || mcp.version,
          author: mcp.package_info?.author || mcp.author,
          license: mcp.package_info?.license || mcp.license,
          
          // Installation and setup
          install_command: mcp.install_command,
          install_args: mcp.install_args || [],
          alternative_installs: mcp.alternative_installs || [],
          setup_time_minutes: mcp.setup_time_minutes || 5,
          prerequisites: mcp.prerequisites || [],
          post_install_steps: mcp.post_install_steps || [],
          
          // Environment and configuration
          required_env_vars: mcp.required_env_vars || [],
          optional_env_vars: mcp.optional_env_vars || [],
          claude_config: mcp.claude_config || {},
          
          // Technical details
          tools_schema: mcp.tools_schema || [],
          features: mcp.features || [],
          requirements: mcp.requirements || [],
          dependencies: mcp.dependencies || [],
          security_features: mcp.security_features || [],
          
          // Content and documentation
          integration_steps: mcp.integration_steps || [],
          changelog: mcp.changelog || [],
          use_cases: mcp.use_cases || [],
          examples: mcp.examples || [],
          readme_content: mcp.readme_content,
          documentation_url: mcp.documentation_url,
          troubleshooting_guide: mcp.troubleshooting_guide || {},
          
          // Media and content
          video_tutorials: mcp.video_tutorials || [],
          blog_posts: mcp.blog_posts || [],
          case_studies: mcp.case_studies || [],
          
          // Quality and maturity
          difficulty_level: mcp.difficulty_level || 'intermediate',
          maintenance_status: mcp.maintenance_status || 'active',
          maturity_level: mcp.maturity_level || 'stable',
          content_quality_score: mcp.content_quality_score || 0,
          user_engagement_score: mcp.user_engagement_score || 0,
          
          // Performance and analytics
          performance_metrics: mcp.performance_metrics || {},
          resource_requirements: mcp.resource_requirements || {},
          success_rate: mcp.success_rate || 0.95,
          avg_response_time_ms: mcp.avg_response_time_ms || 0,
          weekly_downloads: mcp.weekly_downloads || 0,
          monthly_active_users: mcp.monthly_active_users || 0,
          
          // Community and social
          community_size: mcp.community_size || 0,
          contributor_count: mcp.contributor_count || 0,
          issue_count: mcp.issue_count || 0,
          pr_count: mcp.pr_count || 0,
          
          // Enterprise and business
          enterprise_features: mcp.enterprise_features || [],
          sla_details: mcp.sla_details || {},
          compliance_certifications: mcp.compliance_certifications || [],
          
          // Platform compatibility
          supported_platforms: mcp.supported_platforms || ["linux", "macos", "windows"],
          minimum_node_version: mcp.minimum_node_version,
          minimum_python_version: mcp.minimum_python_version,
          docker_support: mcp.docker_support || false,
          cloud_ready: mcp.cloud_ready || false,
          
          // Marketplace features
          verified_publisher: mcp.verified_publisher || false,
          staff_pick: mcp.staff_pick || false,
          trending_score: mcp.trending_score || 0,
          featured_until: mcp.featured_until,
          
          // Metadata
          size: mcp.size || 'Medium',
          website: mcp.website || mcp.github_url,
          tags: Array.isArray(mcp.tags) ? mcp.tags : [],
          update_frequency: mcp.update_frequency || 'monthly',
          last_major_update: mcp.last_major_update,
          last_synced_at: new Date().toISOString(),
          sync_hash: `${source}_${Date.now()}_${slug}`,
          
          // AI-extracted fields for tenant vector stores
          available_tools: mcp.available_tools || [],
          available_actions: mcp.available_actions || [],
          raw_readme_content: mcp.raw_readme_content || '',
          ai_extraction_quality: 0.95,
          extraction_model: 'llama3.2:latest',
          extraction_timestamp: new Date().toISOString()
        };

        if (existing) {
          // Update existing entry
          const { error: updateError } = await supabase
            .from('mcp_catalog')
            .update(mcpData)
            .eq('id', existing.id);

          if (updateError) {
            results.errors.push(`Update failed for ${mcp.name}: ${updateError.message}`);
          } else {
            results.updated++;
            console.log(`✅ Updated: ${mcp.name}`);
          }
        } else {
          // Insert new entry
          const { error: insertError } = await supabase
            .from('mcp_catalog')
            .insert(mcpData);

          if (insertError) {
            results.errors.push(`Insert failed for ${mcp.name}: ${insertError.message}`);
          } else {
            results.inserted++;
            console.log(`✅ Inserted: ${mcp.name}`);
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (mcpError) {
        results.errors.push(`Processing failed for ${mcp.name}: ${String(mcpError)}`);
        console.error(`❌ Error processing ${mcp.name}:`, mcpError);
      }
    }

    console.log(`🎉 Upload completed: ${results.inserted} inserted, ${results.updated} updated, ${results.errors.length} errors`);

    res.json({
      success: true,
      message: `Successfully processed ${results.inserted + results.updated} MCPs`,
      results,
      source
    });

  } catch (error) {
    console.error('Upload scraped data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;