// Recorder Studio - Simple workflow: Record → Generate → Name & Save
// No upfront session setup - name and describe tools after generation

import React, { useState, useEffect, useRef } from 'react';
import { Video, Wrench, ArrowLeft, Eye, RefreshCw, Play, Square, Camera, Sparkles, Lightbulb, Copy, Save, Bot, Loader2, FileText, Download, Trash2, TestTube } from 'lucide-react';
import { useTenant } from '../hooks/useTenant';
import { RecordingService, RecordedAction } from '../services/RecordingService';
import { createExtensionService, ExtensionStatus } from '../services/ExtensionService';
import { OnboardingDemoModal } from './OnboardingDemoModal';

interface RecorderStudioProps {
  onNavigateToAgent?: () => void;
  onNavigateToTools?: () => void;
}

export function RecorderStudio({ onNavigateToAgent, onNavigateToTools }: RecorderStudioProps) {
  const { tenant } = useTenant();
  const [recordingService] = useState(() => new RecordingService(tenant?.id || ''));
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [actions, setActions] = useState<RecordedAction[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connected' | 'error'>('disconnected');
  const [recordingTime, setRecordingTime] = useState(0);
  
  // Code generation state
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [sessionForGeneration, setSessionForGeneration] = useState<any>(null);
  
  // Tool naming state (after generation)
  const [showNamingModal, setShowNamingModal] = useState(false);
  const [toolName, setToolName] = useState('');
  const [toolDescription, setToolDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Tool testing state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [testError, setTestError] = useState('');
  
  // Tab state for switching between recording and tool library
  const [activeTab, setActiveTab] = useState<'recording' | 'tools'>('recording');
  
  // Saved tools state
  const [savedTools, setSavedTools] = useState<any[]>([]);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  
  // Onboarding demo modal state
  const [showOnboardingDemo, setShowOnboardingDemo] = useState(false);
  
  // Refs
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  const actionPollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Extension connection check and action streaming setup
  useEffect(() => {
    const checkExtensionImmediately = async () => {
      try {
        // Use tenant ID if available, otherwise use a default
        const tenantId = tenant?.id || 'default';
        const extensionService = createExtensionService(tenantId);
        const status = await extensionService.checkConnectionStatus();
        
        if (status.connected) {
          setConnectionStatus('connected');
          // Load actions when extension connects
          await loadCurrentSessionActions();
        } else if (status.error) {
          setConnectionStatus('error');
        } else {
          setConnectionStatus('disconnected');
        }
      } catch (error) {
        console.log('Immediate extension check failed:', error);
        setConnectionStatus('disconnected');
      }
    };

    checkExtensionImmediately();
    
    // Listen for extension tool generation events
    const handleToolGeneration = async () => {
      console.log('🔧 Tool generation event received, loading actions...');
      await loadCurrentSessionActions();
    };
    
    // Listen for extension messages
    const handleExtensionMessage = (event: MessageEvent) => {
      if (event.data?.type === 'toolGenerated') {
        console.log('🔧 Extension tool generation message received');
        handleToolGeneration();
      }
    };
    
    window.addEventListener('extensionToolGenerated', handleToolGeneration);
    window.addEventListener('message', handleExtensionMessage);
    
    return () => {
      window.removeEventListener('extensionToolGenerated', handleToolGeneration);
      window.removeEventListener('message', handleExtensionMessage);
    };
  }, []); // Run once on mount
  
  // Check for getting-started URL parameter to show demo modal
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('getting-started') === 'true') {
      setShowOnboardingDemo(true);
      // Clean up URL parameter
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('getting-started');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, []);
  
  // Helper function to load current session actions
  const loadCurrentSessionActions = async () => {
    try {
      const status = await recordingService.checkRecordingStatus();
      if (status.currentSession) {
        const fullSession = await recordingService.getSessionStatus(status.currentSession.id);
        if (fullSession.actions && fullSession.actions.length > 0) {
          console.log(`📝 Loaded ${fullSession.actions.length} actions from current session`);
          setActions(fullSession.actions);
          setSessionForGeneration(fullSession);
        }
      } else {
        // Fallback: get most recent completed session
        const sessions = await recordingService.getSessions();
        const recentCompleted = sessions.find(s => s.status === 'completed' || s.status === 'stopped');
        if (recentCompleted && recentCompleted.actions) {
          console.log(`📝 Loaded ${recentCompleted.actions.length} actions from recent completed session`);
          setActions(recentCompleted.actions);
          setSessionForGeneration(recentCompleted);
        }
      }
    } catch (error) {
      console.warn('Failed to load session actions:', error);
    }
  };

  // Reset UI state when extension disconnects
  const resetUIOnDisconnect = () => {
    console.log('🔄 Extension disconnected - resetting UI state');
    
    // Stop any active recording
    if (isRecording) {
      setIsRecording(false);
      setRecordingTime(0);
      
      // Clear recording intervals
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
        recordingInterval.current = null;
      }
      if (actionPollingInterval.current) {
        clearInterval(actionPollingInterval.current);
        actionPollingInterval.current = null;
      }
    }
    
    // Clear session data
    setActions([]);
    setSessionForGeneration(null);
    
    // Reset generated tool data
    setGeneratedCode('');
    setShowCode(false);
    setIsGenerating(false);
    setIsTestingTool(false);
    setTestResults(null);
    
    console.log('✅ UI state reset complete');
  };

  useEffect(() => {
    loadCurrentSession();
    loadSavedTools();
    
    // Set up extension connection monitoring (same as Header)
    if (tenant?.id) {
      const extensionService = createExtensionService(tenant.id);
      
      const handleStatusUpdate = (status: ExtensionStatus) => {
        if (status.connected) {
          setConnectionStatus('connected');
        } else if (status.error) {
          setConnectionStatus('error');
          // Reset UI state when extension has error
          resetUIOnDisconnect();
        } else {
          setConnectionStatus('disconnected');
          // Reset UI state when extension disconnects
          resetUIOnDisconnect();
        }
      };

      extensionService.startMonitoring(handleStatusUpdate);

      // Set up recording status polling for sync with extension
      const checkRecordingStatus = async () => {
        try {
          const response = await recordingService.checkRecordingStatus();
          if (response.isRecording && !isRecording) {
            // Extension started recording - sync frontend state
            setIsRecording(true);
            if (response.currentSession) {
              setActions(response.currentSession.actions || []);
            }
          } else if (!response.isRecording && isRecording) {
            // Extension stopped recording - sync frontend state  
            setIsRecording(false);
            if (recordingInterval.current) {
              clearInterval(recordingInterval.current);
              recordingInterval.current = null;
            }
          }
        } catch (error) {
          // Silent fail - not critical
        }
      };

      // Poll every 2 seconds for recording status sync
      const statusInterval = setInterval(checkRecordingStatus, 2000);

      return () => {
        extensionService.stopMonitoring(handleStatusUpdate);
        clearInterval(statusInterval);
        if (recordingInterval.current) clearInterval(recordingInterval.current);
        if (actionPollingInterval.current) clearInterval(actionPollingInterval.current);
      };
    }
  }, [tenant?.id, isRecording]);

  const loadCurrentSession = async () => {
    try {
      console.log('🔄 Loading current session...');
      
      // First check if there's an active recording via status endpoint
      const status = await recordingService.checkRecordingStatus();
      console.log('📊 Initial recording status:', status);
      
      if (status.isRecording && status.currentSession) {
        console.log('🎬 Active recording found, loading session data...');
        // There's an active recording, get the full session data
        try {
          const fullSession = await recordingService.getSessionStatus(status.currentSession.id);
          console.log('📝 Active session loaded:', fullSession);
          setActions(fullSession.actions || []);
          setIsRecording(true);
          setRecordingTime(Date.now() - (fullSession.startTime || Date.now()));
          startActionPolling();
          startRecordingTimer();
          return; // Exit early since we found an active session
        } catch (sessionError) {
          console.warn('Failed to get active session details:', sessionError);
        }
      } 
      
      // No active recording found, look for recent completed sessions
      console.log('📋 No active recording, loading latest completed session...');
      const sessions = await recordingService.getSessions();
      console.log('📋 All sessions found:', sessions.map(s => ({
        id: s.id?.slice(0, 8) + '...',
        name: s.name,
        status: s.status,
        actionsCount: s.actionsCount || 0,
        startTime: s.startTime ? new Date(s.startTime).toLocaleTimeString() : 'unknown'
      })));
      
      // Find the most recent stopped session with actions
      const recentStoppedSessions = sessions
        .filter(s => s.status === 'stopped' && (s.actionsCount || 0) > 0)
        .sort((a, b) => (b.endTime || b.startTime || 0) - (a.endTime || a.startTime || 0));
      
      console.log('📋 Recent stopped sessions with actions:', recentStoppedSessions.length);
      
      if (recentStoppedSessions.length > 0) {
        const latestSession = recentStoppedSessions[0];
        console.log(`📝 Loading latest session: ${latestSession.name} (${latestSession.actionsCount} actions)`);
        
        try {
          // Fetch the full session details including actions
          const fullSession = await recordingService.getSessionStatus(latestSession.id);
          console.log('📝 Full session loaded:', {
            id: fullSession.id?.slice(0, 8) + '...',
            status: fullSession.status,
            actionsCount: fullSession.actions?.length || 0,
            hasActions: !!fullSession.actions
          });
          
          if (fullSession.actions && fullSession.actions.length > 0) {
            console.log(`✅ Loading ${fullSession.actions.length} actions from session: ${fullSession.name}`);
            setActions(fullSession.actions);
          } else {
            console.warn('⚠️ Session has no actions despite actionsCount > 0');
            setActions([]);
          }
        } catch (error) {
          console.error('❌ Failed to fetch full session details:', error);
          // Fallback: show empty state but log the issue
          setActions([]);
        }
      } else {
        console.log('ℹ️ No sessions with recorded actions found');
        setActions([]);
      }
      
    } catch (error) {
      console.error('❌ Failed to load current session:', error);
      setActions([]);
    }
  };

  const startRecording = async () => {
    if (connectionStatus !== 'connected') {
      alert('Browser extension is not connected. Please install and connect the browser extension.');
      return;
    }

    try {
      console.log('🚀 Opening recording start page - no recording started yet');
      
      // DON'T create backend session yet - wait until user clicks "Go & Start Recording"
      // DON'T start any timers or polling yet
      // Just open the recording start page
      window.open('/recording-start', '_blank');
      
    } catch (error) {
      console.error('Failed to open recording start page:', error);
      alert('Failed to open recording start page. Please try again.');
    }
  };

  const stopRecording = async () => {
    try {
      console.log('⏹️ Stopping recording from frontend...');
      
      // Tell the extension to stop recording FIRST to ensure clean state
      try {
        console.log('📡 Sending stopRecording message to extension');
        const response = await (window as any).chrome?.runtime?.sendMessage({
          type: 'stopRecording'
        });
        
        if (response?.success) {
          console.log('✅ Extension recording stopped successfully');
        } else {
          console.warn('Extension stop recording returned:', response);
        }
      } catch (extensionError) {
        console.warn('Warning: Failed to stop extension recording:', extensionError);
        // Continue anyway - backend stop is more important
      }
      
      // Then stop the backend recording
      await recordingService.stopRecording();
      console.log('✅ Backend recording stopped successfully');
      
      setIsRecording(false);
      
      // Stop polling and timer
      if (actionPollingInterval.current) {
        clearInterval(actionPollingInterval.current);
        actionPollingInterval.current = null;
      }
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
        recordingInterval.current = null;
      }
      
      // Load the completed session's actions
      setTimeout(async () => {
        try {
          console.log('📋 Loading completed session actions...');
          const sessions = await recordingService.getSessions();
          const latestSession = sessions.find(s => s.status === 'stopped') || sessions[0];
          if (latestSession && latestSession.actionsCount > 0) {
            console.log(`📝 Found session with ${latestSession.actionsCount} actions, fetching full details...`);
            try {
              const fullSession = await recordingService.getSessionStatus(latestSession.id);
              if (fullSession.actions && fullSession.actions.length > 0) {
                console.log(`📝 Loaded ${fullSession.actions.length} actions from completed session`);
                setActions(fullSession.actions);
              }
            } catch (error) {
              console.warn('Failed to fetch completed session details:', error);
            }
          }
        } catch (error) {
          console.warn('Failed to load completed session actions:', error);
        }
      }, 1000); // Small delay to ensure backend has processed the stop
      
    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert('Failed to stop recording. Please try again.');
    }
  };

  const startActionPolling = () => {
    if (actionPollingInterval.current) return;
    
    console.log('🔄 Starting action polling...');
    
    actionPollingInterval.current = setInterval(async () => {
      try {
        // Check current recording status first
        const status = await recordingService.checkRecordingStatus();
        console.log('📊 Recording status:', status);
        
        if (status.isRecording && status.currentSession) {
          // Fetch the full session data with actions
          try {
            const fullSession = await recordingService.getSessionStatus(status.currentSession.id);
            console.log('📝 Full session data:', fullSession);
            const newActions = fullSession.actions || [];
            
            // CRITICAL FIX: Use callback to avoid stale closure
            setActions(prevActions => {
              if (newActions.length !== prevActions.length) {
                console.log(`🔄 Updating actions: ${prevActions.length} → ${newActions.length}`);
                return newActions;
              }
              return prevActions; // No change needed
            });
            
            // Update recording time based on session
            if (fullSession.startTime) {
              setRecordingTime(Date.now() - fullSession.startTime);
            }
          } catch (sessionError) {
            console.warn('Failed to get session details, falling back to sessions list:', sessionError);
            // Fallback: get from sessions list
            const sessions = await recordingService.getSessions();
            console.log('📋 Fallback sessions:', sessions);
            const activeSession = sessions.find(s => s.id === status.currentSession?.id || s.status === 'recording');
            if (activeSession) {
              const newActions = activeSession.actions || [];
              setActions(prevActions => {
                if (newActions.length !== prevActions.length) {
                  console.log(`🔄 Fallback updating actions: ${prevActions.length} → ${newActions.length}`);
                  return newActions;
                }
                return prevActions;
              });
            }
          }
        } else if (!status.isRecording) {
          // No recording and no session - stop polling
          if (actionPollingInterval.current) {
            console.log('⏹️ No recording session, ending action polling');
            clearInterval(actionPollingInterval.current);
            actionPollingInterval.current = null;
          }
        }
      } catch (error) {
        console.error('❌ Failed to poll actions:', error);
      }
    }, 2000); // Poll every 2 seconds to reduce load
  };

  const startRecordingTimer = () => {
    if (recordingInterval.current) return;
    
    recordingInterval.current = setInterval(() => {
      setRecordingTime(prev => prev + 1000);
    }, 1000);
  };

  const generateCode = async () => {
    if (actions.length === 0) {
      alert('No actions recorded to generate code from');
      return;
    }

    setIsGenerating(true);
    setGeneratedCode('');
    setGenerationError('');
    console.log('🔧 Starting tool generation with', actions.length, 'actions');

    try {
      // First approach: try to use the general endpoint if we have a current recording
      if (isRecording) {
        console.log('📝 Trying to generate from active recording session');
        try {
          // Show naming modal BEFORE generation so we can pass name to API
          const suggestedName = generateToolNameFromActions(actions);
          setToolName(suggestedName);
          setToolDescription(`Automation tool with ${actions.length} recorded actions (active session)`);
          setShowNamingModal(true);
          return;
        } catch (activeError) {
          console.warn('Failed to generate from active session:', activeError);
        }
      }

      // Second approach: find a session from the sessions list
      const sessions = await recordingService.getSessions();
      console.log('📋 Available sessions for tool generation:', sessions);
      
      // The sessions endpoint only returns actionsCount, not the actual actions
      // Find sessions that have actionsCount > 0
      const sessionsWithActions = sessions.filter(s => 
        (s.actionsCount && s.actionsCount > 0) || (s.actions && s.actions.length > 0)
      );
      
      console.log(`🔍 Found ${sessionsWithActions.length} sessions with actions out of ${sessions.length} total`);
      
      if (sessionsWithActions.length === 0) {
        console.error('❌ No sessions found with actions. Session details:', sessions.map(s => ({
          id: s.id,
          name: s.name,
          status: s.status,
          actionsCount: s.actionsCount || (s.actions?.length || 0)
        })));
        
        // If we have actions in memory but no sessions, try the general endpoint anyway
        console.log('🔄 Attempting fallback generation...');
        try {
          // Show naming modal BEFORE generation so we can pass name to API
          const suggestedName = generateToolNameFromActions(actions);
          setToolName(suggestedName);
          setToolDescription(`Automation tool with ${actions.length} recorded actions`);
          setShowNamingModal(true);
          return;
        } catch (fallbackError) {
          throw new Error(`No sessions with actions found for tool generation. Found ${sessions.length} sessions total, 0 with actions.`);
        }
      }
      
      // Use the first session with actions (most recent)
      const sessionForGeneration = sessionsWithActions[0];
      console.log('🎯 Using session for generation:', sessionForGeneration);
      
      // Store the session for testing later
      setSessionForGeneration(sessionForGeneration);
      
      // Generate code from the specific session
      // Show naming modal BEFORE generation so we can pass name to API
      const suggestedName = generateToolNameFromActions(actions);
      setToolName(suggestedName);
      setToolDescription(`Automation tool with ${actions.length} recorded actions from session: ${sessionForGeneration.name}`);
      setSessionForGeneration(sessionForGeneration); // Store session for actual generation
      setShowNamingModal(true);
      
    } catch (error) {
      console.error('Failed to generate code:', error);
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate code');
    } finally {
      setIsGenerating(false);
    }
  };

  const testGeneratedTool = async () => {
    if (!generatedCode) {
      alert('No generated tool to test');
      return;
    }

    setIsTesting(true);
    setTestResult('');
    setTestError('');

    try {
      // Find the most recent session if sessionForGeneration is not available
      let sessionId = sessionForGeneration?.id;
      
      if (!sessionId && sessions.length > 0) {
        // Use the most recent stopped session
        const recentSession = sessions.find(s => s.status === 'stopped') || sessions[0];
        sessionId = recentSession?.id;
      }
      
      if (sessionId) {
        // Use session ID to generate and test Playwright code for better compatibility
        const response = await recordingService.testGeneratedTool(generatedCode, sessionId);
        setTestResult(response.result || 'Tool executed successfully');
      } else {
        // Fallback to testing the generated MCP code directly (though this may not work well)
        const response = await recordingService.testGeneratedTool(generatedCode);
        setTestResult(response.result || 'Tool executed successfully');
      }
    } catch (error) {
      console.error('Failed to test tool:', error);
      setTestError(error instanceof Error ? error.message : 'Failed to test tool');
    } finally {
      setIsTesting(false);
    }
  };

  const resetSession = async () => {
    console.log('🔄 Resetting session and clearing all data...');
    
    try {
      // Stop any active recording first
      if (isRecording) {
        await stopRecording();
      }
      
      // Clear all UI state
      setActions([]);
      setGeneratedCode('');
      setSessionForGeneration(null);
      setGenerationError('');
      setTestResult('');
      setTestError('');
      setToolName('');
      setToolDescription('');
      setShowNamingModal(false);
      
      // Reset recording state
      setRecordingTime(0);
      setIsGenerating(false);
      setIsTesting(false);
      setIsSaving(false);
      
      // Clear intervals
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
        recordingInterval.current = null;
      }
      if (actionPollingInterval.current) {
        clearInterval(actionPollingInterval.current);
        actionPollingInterval.current = null;
      }
      
      // Call backend to clear any session data
      try {
        await recordingService.forceStopRecording();
        console.log('✅ Backend recording force-stopped');
        
        // CRITICAL FIX: Explicitly clear all stored sessions to prevent "toystory" persistence
        await recordingService.clearAllSessions();
        console.log('✅ All backend sessions cleared');
      } catch (backendError) {
        console.warn('Warning: Failed to clear backend session:', backendError);
        // Continue anyway - UI reset is more important
      }

      // CRITICAL: Clear extension storage to prevent state restoration after refresh
      try {
        // Send message to extension to clear its storage
        await (window as any).chrome?.runtime?.sendMessage({ type: 'clearStorage' });
        console.log('🧹 Extension storage cleared via frontend');
      } catch (extensionError) {
        console.warn('Warning: Failed to clear extension storage:', extensionError);
        // Continue anyway - not all users may have extension installed
      }
      
      console.log('✅ Session reset complete');
      
    } catch (error) {
      console.error('❌ Failed to reset session:', error);
      // Reset UI state anyway, even if backend calls fail
      setActions([]);
      setGeneratedCode('');
      setSessionForGeneration(null);
      setGenerationError('');
      setTestResult('');
      setTestError('');
      setRecordingTime(0);
    }
  };

  const generateToolNameFromActions = (actions: RecordedAction[]): string => {
    // Simple heuristic to suggest a tool name based on actions
    const hasLogin = actions.some(a => 
      a.description.toLowerCase().includes('login') || 
      a.description.toLowerCase().includes('sign in') ||
      a.selector?.toLowerCase().includes('password')
    );
    
    const hasForm = actions.some(a => 
      a.type === 'type' || 
      a.description.toLowerCase().includes('submit') ||
      a.description.toLowerCase().includes('form')
    );
    
    const hasNavigation = actions.some(a => a.type === 'navigate');
    
    if (hasLogin) return 'login_automation';
    if (hasForm) return 'form_filler';
    if (hasNavigation) return 'web_navigator';
    return 'browser_automation';
  };

  const loadSavedTools = async () => {
    setIsLoadingTools(true);
    try {
      const tools = await recordingService.getSavedTools();
      setSavedTools(tools);
    } catch (error) {
      console.error('Failed to load saved tools:', error);
    } finally {
      setIsLoadingTools(false);
    }
  };

  // Function to actually generate the code (called from naming modal)
  const generateToolWithName = async () => {
    if (!toolName.trim()) {
      alert('Please enter a tool name');
      return;
    }

    setIsGenerating(true);
    setShowNamingModal(false); // Close modal
    try {
      console.log('🔧 Generating tool with custom name/description:', { toolName, toolDescription });
      
      // Generate the code with the custom name and description
      let code = '';
      if (sessionForGeneration) {
        // Generate from specific session
        code = await recordingService.generateToolFromSpecificSession(
          sessionForGeneration.id, 
          toolName, 
          toolDescription
        );
      } else {
        // Generate from current/latest session
        code = await recordingService.generateTool(toolName, toolDescription);
      }
      
      setGeneratedCode(code);
      console.log('✅ Tool code generated with custom name/description');
      
    } catch (error) {
      console.error('Failed to generate tool:', error);
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate tool');
    } finally {
      setIsGenerating(false);
    }
  };

  // Function to save the already generated tool
  const saveGeneratedTool = async () => {
    if (!toolName.trim() || !generatedCode) {
      alert('Please generate a tool first');
      return;
    }

    setIsSaving(true);
    try {
      await recordingService.saveGeneratedTool(toolName, toolDescription, generatedCode);
      alert(`Tool "${toolName}" saved successfully!`);
      
      // Reload saved tools to show the new one
      await loadSavedTools();
      
      // Clear the current work
      setGeneratedCode('');
      setActions([]);
      setToolName('');
      setToolDescription('');
      
    } catch (error) {
      console.error('Failed to save tool:', error);
      alert('Failed to save tool: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTool = async (toolId: string) => {
    if (!confirm('Are you sure you want to delete this tool?')) {
      return;
    }

    try {
      await recordingService.deleteTool(toolId);
      await loadSavedTools();
      alert('Tool deleted successfully!');
    } catch (error) {
      console.error('Failed to delete tool:', error);
      alert('Failed to delete tool. Please try again.');
    }
  };

  const downloadTool = (tool: { code: string; name: string }) => {
    const blob = new Blob([tool.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tool.name}.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getActionIcon = (type: string) => {
    const iconProps = "w-5 h-5";
    switch (type) {
      case 'navigate': return <ArrowLeft className={`${iconProps} text-blue-400`} />;
      case 'click': return <Video className={`${iconProps} text-green-400`} />;
      case 'type': return <FileText className={`${iconProps} text-purple-400`} />;
      case 'scroll': return <RefreshCw className={`${iconProps} text-orange-400`} />;
      case 'wait': return <Loader2 className={`${iconProps} text-gray-400`} />;
      case 'screenshot': return <Camera className={`${iconProps} text-cyan-400`} />;
      default: return <Wrench className={`${iconProps} text-gray-400`} />;
    }
  };

  const getActionCategory = (type: string) => {
    switch (type) {
      case 'navigate': return 'Navigation';
      case 'click': return 'Interaction';
      case 'type': return 'Input';
      case 'scroll': return 'Interaction';
      case 'wait': return 'System';
      case 'screenshot': return 'Capture';
      default: return 'Other';
    }
  };

  const getHumanReadableDescription = (action: { type: string; description: string; text?: string; value?: string; selector?: string }) => {
    switch (action.type) {
      case 'navigate':
        const url = action.description.replace('Navigate to ', '');
        return `Navigate to ${compactUrl(url, 30)}`;
      case 'click':
        if (action.text) {
          return `Click "${action.text}" button`;
        } else if (action.selector?.includes('button')) {
          return 'Click button';
        } else if (action.selector?.includes('input')) {
          return 'Click input field';
        } else if (action.selector?.includes('link') || action.selector?.includes('a[')) {
          return 'Click link';
        } else {
          return 'Click element';
        }
      case 'type':
        return `Type "${action.text || 'text'}"`;
      case 'scroll':
        return 'Scroll page';
      case 'wait':
        return 'Wait for page to load';
      case 'screenshot':
        return 'Capture screenshot';
      default:
        return action.description || `Perform ${action.type} action`;
    }
  };

  const groupActionsByCategory = (actions: any[]) => {
    const grouped = actions.reduce((acc, action, index) => {
      const category = getActionCategory(action.type);
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push({ ...action, originalIndex: index });
      return acc;
    }, {} as Record<string, any[]>);

    // Sort categories by importance
    const categoryOrder = ['Navigation', 'Input', 'Interaction', 'Capture', 'System', 'Other'];
    return categoryOrder.filter(cat => grouped[cat]).map(cat => ({
      category: cat,
      actions: grouped[cat]
    }));
  };

  const compactUrl = (url: string, maxLength: number = 40): string => {
    if (url.length <= maxLength) return url;
    
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const path = urlObj.pathname + urlObj.search;
      
      // If just domain + path is still too long, truncate the path
      if ((domain + path).length > maxLength) {
        const availableForPath = maxLength - domain.length - 3; // -3 for "..."
        if (availableForPath > 10) {
          return `${domain}${path.substring(0, availableForPath)}...`;
        } else {
          return `${domain}...`;
        }
      }
      
      return domain + path;
    } catch {
      // If URL parsing fails, just truncate the string
      return url.substring(0, maxLength - 3) + '...';
    }
  };

  const simplifySelector = (selector: string): string => {
    if (!selector) return '';
    
    // Extract the basic element type from complex selectors
    // Examples:
    // "input#twotabsearchtextbox.nav-input" → "input"
    // "button.btn.btn-primary" → "button" 
    // "div.container > p.text" → "div > p"
    
    try {
      // Split by spaces to handle descendant selectors
      const parts = selector.split(' ').map(part => {
        // Remove IDs and classes, keep just the element type
        const element = part.split(/[#.]/)[0];
        return element || part;
      });
      
      // Join back with spaces, but limit length
      const simplified = parts.join(' ');
      return simplified.length > 25 ? simplified.substring(0, 22) + '...' : simplified;
    } catch {
      // Fallback: just truncate if parsing fails
      return selector.length > 25 ? selector.substring(0, 22) + '...' : selector;
    }
  };

  const getConnectionStatusDisplay = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <div className="flex items-center space-x-2 text-sm px-4 py-2 rounded-full border transition-all duration-300 bg-green-500/10 border-green-500/30 text-green-400 shadow-lg shadow-green-500/20">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            <span className="font-medium">Connected</span>
          </div>
        );
      case 'disconnected':
      case 'error':
        return (
          <div className="flex items-center space-x-2 text-sm px-4 py-2 rounded-full border transition-all duration-300 bg-orange-500/10 border-orange-500/30 text-orange-400 shadow-lg shadow-orange-500/20">
            <div className="w-2 h-2 rounded-full bg-orange-400"></div>
            <span className="font-medium">Extension Not Connected</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center space-x-2 text-sm px-4 py-2 rounded-full border transition-all duration-300 bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-lg shadow-blue-500/20">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
            <span className="font-medium">Checking...</span>
          </div>
        );
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-lg p-6 min-h-full">
      <div className="max-w-7xl mx-auto">
        {/* Header with View Toggle */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
              <Video className="w-10 h-10 text-purple-400" />
              Recording Studio
            </h1>
            <p className="text-gray-300">
              Record → Generate → Name & Save your automation tools
            </p>
          </div>
          
          <button
            onClick={() => setActiveTab(activeTab === 'recording' ? 'tools' : 'recording')}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 hover:scale-105"
          >
            {activeTab === 'recording' ? (
              <>
                <Eye className="w-5 h-5" />
                View Generated Tools
                {savedTools.length > 0 && (
                  <span className="bg-purple-500 text-white text-xs px-2 py-1 rounded-full ml-1">
                    {savedTools.length}
                  </span>
                )}
              </>
            ) : (
              <>
                <ArrowLeft className="w-5 h-5" />
                Back to Recording
              </>
            )}
          </button>
        </div>

        {activeTab === 'recording' && (
          <>
            {/* Connection Status */}
            <div className="mb-6 p-4 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-semibold">Browser Extension Status</h3>
                  <p className="text-gray-300 text-sm">Extension must be connected to record actions</p>
                </div>
                <div className="text-right">
                  {getConnectionStatusDisplay()}
                  {connectionStatus === 'disconnected' && (
                    <p className="text-sm text-gray-400 mt-1">Install browser extension to continue</p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column: Simple Recording Control */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-6">Recording Control</h3>
            
            {!isRecording ? (
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Video className="w-10 h-10 text-white" />
                </div>
                <p className="text-gray-300 mb-6">
                  {connectionStatus === 'connected' 
                    ? 'Ready to record browser actions'
                    : 'Connect extension to begin'
                  }
                </p>
                <button
                  onClick={startRecording}
                  disabled={connectionStatus !== 'connected'}
                  className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden ${
                    connectionStatus === 'connected' && actions.length === 0
                      ? 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white hover:scale-105 shadow-lg shadow-red-500/25'
                      : connectionStatus === 'connected'
                      ? 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white hover:scale-105'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                  style={{
                    ...(connectionStatus === 'connected' && actions.length === 0 && {
                      animation: 'gentleGlow 2.5s ease-in-out infinite'
                    })
                  }}
                >
                  <Play className="w-5 h-5" />
                  Start Recording
                </button>
                {connectionStatus !== 'connected' && (
                  <p className="text-sm text-gray-400 mt-3">
                    Connect browser extension first
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center">
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                </div>
                <h4 className="text-white font-bold text-lg mb-2">Recording Active</h4>
                <p className="text-cyan-400 font-mono text-2xl mb-6">{formatTime(recordingTime)}</p>
                <p className="text-gray-300 mb-6">
                  Navigate and interact with websites.<br/>
                  Your actions are being captured.
                </p>
                <button
                  onClick={stopRecording}
                  className="w-full bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
                >
                  <Square className="w-5 h-5" />
                  Stop Recording
                </button>
              </div>
            )}

            {/* Quick Stats */}
            {actions.length > 0 && connectionStatus === 'connected' && (
              <div className="mt-6 p-4 bg-cyan-500/20 border border-cyan-500/30 rounded-lg">
                <h4 className="text-cyan-300 font-semibold mb-2">Current Session</h4>
                <p className="text-white">{actions.length} actions recorded</p>
                <p className="text-gray-300 text-sm">Ready to generate automation tool</p>
              </div>
            )}
          </div>

          {/* Middle Column: Live Action Feed */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">
                Actions ({actions.length})
              </h3>
              <button
                onClick={resetSession}
                disabled={isRecording}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                  isRecording 
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 hover:text-purple-300 border border-purple-500/30'
                }`}
                title="Clear all actions and reset session"
              >
                <RefreshCw className="w-4 h-4" />
                Reset
              </button>
            </div>
            
            {connectionStatus !== 'connected' ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-orange-400" />
                </div>
                <p className="text-orange-400">Extension Not Connected</p>
                <p className="text-sm text-gray-500 mt-2">Connect browser extension to record actions</p>
              </div>
            ) : actions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-white/80" />
                </div>
                <p className="text-white/90">No actions recorded yet</p>
                <p className="text-sm text-white/70 mt-2">Start recording to see actions here</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto overflow-x-hidden">
                {groupActionsByCategory(actions).map((group) => (
                  <div key={group.category} className="space-y-2">
                    {/* Category Header */}
                    <div className="flex items-center gap-2 px-2">
                      <div className="h-px bg-white/20 flex-1"></div>
                      <span className="text-xs font-medium text-white/60 uppercase tracking-wide px-2">
                        {group.category} ({group.actions.length})
                      </span>
                      <div className="h-px bg-white/20 flex-1"></div>
                    </div>
                    
                    {/* Actions in Category */}
                    <div className="space-y-2">
                      {group.actions.map((action) => (
                        <div
                          key={`${action.timestamp}-${action.originalIndex}`}
                          className="p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors duration-200"
                        >
                          <div className="flex items-start space-x-3">
                            <div className="mt-0.5 flex-shrink-0">{getActionIcon(action.type)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start mb-1">
                                <h4 className="text-white font-medium text-sm leading-relaxed">
                                  {getHumanReadableDescription(action)}
                                </h4>
                                <span className="text-xs text-white/40 ml-2 flex-shrink-0 font-mono">
                                  #{action.originalIndex + 1}
                                </span>
                              </div>
                              
                              {/* Technical Details (Collapsed by default) */}
                              {action.selector && (
                                <div className="mt-2 text-xs">
                                  <details className="group">
                                    <summary className="text-white/40 hover:text-white/60 cursor-pointer select-none list-none">
                                      <span className="inline-flex items-center gap-1">
                                        <span className="transform transition-transform group-open:rotate-90">▶</span>
                                        Technical details
                                      </span>
                                    </summary>
                                    <div className="mt-2 pl-4 space-y-1">
                                      <p className="text-white/30">
                                        <span className="text-white/40">Selector:</span>{' '}
                                        <code className="bg-black/30 px-1 py-0.5 rounded text-xs font-mono text-cyan-300">
                                          {simplifySelector(action.selector)}
                                        </code>
                                      </p>
                                      {action.text && action.type !== 'type' && (
                                        <p className="text-white/30">
                                          <span className="text-white/40">Element text:</span>{' '}
                                          <code className="bg-black/30 px-1 py-0.5 rounded text-xs text-green-300">"{action.text}"</code>
                                        </p>
                                      )}
                                    </div>
                                  </details>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Code Generation */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4">Generate Tool</h3>
            
            {!generatedCode && actions.length === 0 && connectionStatus === 'connected' && (
              <div className="text-center py-8 mb-4">
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-6 h-6 text-white/60" />
                </div>
                <p className="text-white/80 text-sm">Generated tools will appear here</p>
                <p className="text-white/60 text-xs mt-1">Record some actions to get started</p>
              </div>
            )}
            
            <div className="space-y-4">
              <button
                onClick={generateCode}
                disabled={actions.length === 0 || isGenerating || connectionStatus !== 'connected'}
                className={`w-full py-3 px-4 rounded-lg font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                  actions.length > 0 && !isGenerating && connectionStatus === 'connected'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg hover:shadow-xl'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Tool Code
                  </>
                )}
              </button>

              {generationError && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">{generationError}</p>
                </div>
              )}

              {generatedCode && (
                <div className="space-y-3">
                  <div className="bg-black/20 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                      {generatedCode}
                    </pre>
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={() => navigator.clipboard.writeText(generatedCode)}
                      className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center"
                    >
                      Copy
                    </button>
                    <button
                      onClick={testGeneratedTool}
                      disabled={isTesting || connectionStatus !== 'connected'}
                      className={`flex-1 font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center ${
                        isTesting || connectionStatus !== 'connected'
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white'
                      }`}
                    >
                      {isTesting ? 'Testing...' : 'Test'}
                    </button>
                    <button
                      onClick={saveGeneratedTool}
                      disabled={isSaving || !generatedCode || !toolName.trim()}
                      className={`flex-1 font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center ${
                        !isSaving && generatedCode && toolName.trim()
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                          : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {isSaving ? 'Saving...' : 'Save Tool'}
                    </button>
                  </div>

                  {/* Test Results */}
                  {testResult && (
                    <div className="mt-3 p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
                      <p className="text-green-300 text-sm">
                        <strong>✅ Test Successful:</strong> {testResult}
                      </p>
                    </div>
                  )}
                  
                  {testError && (
                    <div className="mt-3 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                      <p className="text-red-300 text-sm">
                        <strong>❌ Test Failed:</strong> {testError}
                      </p>
                    </div>
                  )}

                  {onNavigateToAgent && (
                    <button
                      onClick={onNavigateToAgent}
                      className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
                    >
                      <Bot className="w-4 h-4" />
                      Use in Agent Chat
                    </button>
                  )}
                </div>
              )}

              {!generatedCode && actions.length > 0 && (
                <div className="p-4 bg-cyan-500/20 border border-cyan-500/30 rounded-lg">
                  <p className="text-cyan-300 text-sm flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" />
                    {actions.length} actions ready! Click "Generate Tool Code" to create your automation.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        </>
        )}

        {/* Saved Tools View */}
        {activeTab === 'tools' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Wrench className="w-8 h-8 text-purple-400" />
                  Saved Tools
                </h2>
                <p className="text-gray-300">Browse and manage your generated automation tools</p>
              </div>
              <button
                onClick={loadSavedTools}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            {isLoadingTools ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                </div>
                <p className="text-gray-300">Loading saved tools...</p>
              </div>
            ) : savedTools.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wrench className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-400">No saved tools yet</p>
                <p className="text-sm text-gray-500 mt-2">Create tools in the Record & Generate tab</p>
                <button
                  onClick={() => setActiveTab('recording')}
                  className="mt-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center gap-2"
                >
                  <Video className="w-4 h-4" />
                  Start Recording
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {savedTools.map((tool, index) => (
                  <div key={tool.id || index} className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-2">{tool.name}</h3>
                        <p className="text-gray-300 text-sm mb-2">{tool.description}</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded flex items-center gap-1">
                            <Video className="w-3 h-3" />
                            Generated Tool
                          </span>
                          {tool.sessionId && (
                            <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                              Session: {tool.sessionId.slice(0, 8)}...
                            </span>
                          )}
                          {tool.createdAt && (
                            <span className="bg-gray-500/20 text-gray-300 px-2 py-1 rounded">
                              {new Date(tool.createdAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => downloadTool(tool)}
                          className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-bold py-2 px-3 rounded-lg transition-all duration-300"
                          title="Download tool"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigator.clipboard.writeText(tool.code)}
                          className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-bold py-2 px-3 rounded-lg transition-all duration-300"
                          title="Copy code"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteTool(tool.id)}
                          className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold py-2 px-3 rounded-lg transition-all duration-300"
                          title="Delete tool"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Code Preview */}
                    <div className="bg-black/20 rounded-lg p-4 max-h-48 overflow-y-auto">
                      <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                        {tool.code && tool.code.length > 300 
                          ? `${tool.code.slice(0, 300)}...` 
                          : tool.code || 'No code available'
                        }
                      </pre>
                    </div>

                    {onNavigateToAgent && (
                      <div className="mt-4">
                        <button
                          onClick={onNavigateToAgent}
                          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
                        >
                          <Bot className="w-4 h-4" />
                          Use in Agent Chat
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tool Naming Modal */}
        {showNamingModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">🔧 Generate Your Tool</h3>
              
              <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-3 mb-4">
                <div className="flex items-start space-x-2">
                  <div className="text-blue-400 mt-0.5">💡</div>
                  <div className="text-blue-200 text-sm">
                    <p className="font-medium mb-1">Be precise with naming!</p>
                    <p>AI assistants will use your name and description to understand when and how to use this tool. Make them clear and specific.</p>
                  </div>
                </div>
              </div>
              
              <p className="text-gray-300 text-sm mb-4">
                Ready to generate your automation tool with {actions.length} recorded actions.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Tool Name *
                  </label>
                  <input
                    type="text"
                    value={toolName}
                    onChange={(e) => setToolName(e.target.value)}
                    placeholder="e.g., Gmail Login Assistant, Google Search Tool"
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Use descriptive names that clearly indicate the tool's purpose for AI assistants
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={toolDescription}
                    onChange={(e) => setToolDescription(e.target.value)}
                    placeholder="e.g., Automatically logs into Gmail account using email and password. Handles 2FA if enabled. Use when user needs to access Gmail programmatically."
                    rows={3}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Include when to use this tool, what it accomplishes, and any requirements (login, permissions, etc.)
                  </p>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowNamingModal(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={generateToolWithName}
                    disabled={!toolName.trim() || isGenerating}
                    className={`flex-1 font-bold py-2 px-4 rounded-lg transition-all duration-300 ${
                      toolName.trim() && !isGenerating
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isGenerating ? 'Generating...' : 'Generate Tool'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Onboarding Demo Modal */}
      <OnboardingDemoModal
        isOpen={showOnboardingDemo}
        onClose={() => setShowOnboardingDemo(false)}
        onGoToRecorder={() => setShowOnboardingDemo(false)} // Just close modal since we're already on recorder page
        backendUrl={tenant?.instance?.backendUrl || 'http://localhost:8100'}
      />
    </div>
  );
}