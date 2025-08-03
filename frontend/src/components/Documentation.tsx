import React, { useState } from 'react';
import { Card } from '../ui/Card';

interface VideoWalkthrough {
  id: string;
  title: string;
  description: string;
  duration: string;
  category: 'getting-started' | 'advanced' | 'integrations' | 'troubleshooting';
  thumbnail: string;
  videoUrl?: string;
}

const walkthroughs: VideoWalkthrough[] = [
  {
    id: '1',
    title: 'Getting Started with MyMCP',
    description: 'Learn the basics of setting up your automation workspace and creating your first tool.',
    duration: '5:30',
    category: 'getting-started',
    thumbnail: '/api/placeholder/400/225'
  },
  {
    id: '2',
    title: 'Recording Browser Actions',
    description: 'Master the browser extension and record complex automation workflows.',
    duration: '8:15',
    category: 'getting-started',
    thumbnail: '/api/placeholder/400/225'
  },
  {
    id: '3',
    title: 'Creating AI Agents',
    description: 'Build intelligent agents that can use your tools and make decisions.',
    duration: '12:45',
    category: 'getting-started',
    thumbnail: '/api/placeholder/400/225'
  },
  {
    id: '4',
    title: 'Maestro vs Archon: Understanding the Difference',
    description: 'Learn when to use Maestro for orchestration vs Archon for system building.',
    duration: '6:20',
    category: 'getting-started',
    thumbnail: '/api/placeholder/400/225'
  },
  {
    id: '5',
    title: 'Advanced Tool Configuration',
    description: 'Configure complex tools with custom parameters and error handling.',
    duration: '15:30',
    category: 'advanced',
    thumbnail: '/api/placeholder/400/225'
  },
  {
    id: '6',
    title: 'MCP Server Integration',
    description: 'Connect external MCP servers and expand your automation capabilities.',
    duration: '10:45',
    category: 'integrations',
    thumbnail: '/api/placeholder/400/225'
  },
  {
    id: '7',
    title: 'Marketplace: Installing Tools',
    description: 'Discover and install tools from the MyMCP marketplace.',
    duration: '7:30',
    category: 'integrations',
    thumbnail: '/api/placeholder/400/225'
  },
  {
    id: '8',
    title: 'Debugging Failed Automations',
    description: 'Troubleshoot common issues and debug your automation workflows.',
    duration: '11:20',
    category: 'troubleshooting',
    thumbnail: '/api/placeholder/400/225'
  },
  {
    id: '9',
    title: 'Performance Optimization',
    description: 'Optimize your tools and agents for better performance and reliability.',
    duration: '9:45',
    category: 'advanced',
    thumbnail: '/api/placeholder/400/225'
  }
];

const categories = [
  { id: 'all', name: 'All Videos', icon: '🎥' },
  { id: 'getting-started', name: 'Getting Started', icon: '🚀' },
  { id: 'advanced', name: 'Advanced', icon: '⚡' },
  { id: 'integrations', name: 'Integrations', icon: '🔗' },
  { id: 'troubleshooting', name: 'Troubleshooting', icon: '🔧' }
];

export function Documentation() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedVideo, setSelectedVideo] = useState<VideoWalkthrough | null>(null);

  const filteredWalkthroughs = selectedCategory === 'all' 
    ? walkthroughs 
    : walkthroughs.filter(w => w.category === selectedCategory);

  const handleVideoClick = (video: VideoWalkthrough) => {
    setSelectedVideo(video);
  };

  const closeVideo = () => {
    setSelectedVideo(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Documentation & Walkthroughs</h1>
          <p className="text-xl text-gray-300 max-w-3xl">
            Learn how to master MyMCP with our comprehensive video tutorials and documentation. 
            From basic setup to advanced automation techniques.
          </p>
        </div>

        {/* Category Filter */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-3">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                  selectedCategory === category.id
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
                }`}
              >
                <span className="mr-2">{category.icon}</span>
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWalkthroughs.map((video) => (
            <Card
              key={video.id}
              className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/15 transition-all duration-300 cursor-pointer group"
              onClick={() => handleVideoClick(video)}
            >
              <div className="relative">
                {/* Video Thumbnail */}
                <div className="aspect-video bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg mb-4 relative overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors">
                      <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                    {video.duration}
                  </div>
                </div>

                {/* Video Info */}
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                    {video.title}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {video.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      video.category === 'getting-started' ? 'bg-green-500/20 text-green-400' :
                      video.category === 'advanced' ? 'bg-purple-500/20 text-purple-400' :
                      video.category === 'integrations' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-orange-500/20 text-orange-400'
                    }`}>
                      {video.category.replace('-', ' ')}
                    </span>
                    <span className="text-xs text-gray-500">{video.duration}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Quick Start Guide */}
        <div className="mt-12">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <div className="p-8">
              <h2 className="text-2xl font-bold text-white mb-6">Quick Start Guide</h2>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold text-cyan-400 mb-3">1. Install Browser Extension</h3>
                  <p className="text-gray-300 mb-4">
                    Download and install the MyMCP browser extension to start recording your automation workflows.
                  </p>
                  <button className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:from-cyan-600 hover:to-blue-700 transition-all">
                    Download Extension
                  </button>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-cyan-400 mb-3">2. Configure Your Settings</h3>
                  <p className="text-gray-300 mb-4">
                    Set up your AI providers, database connection, and other essential settings to get started.
                  </p>
                  <button className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:from-purple-600 hover:to-indigo-700 transition-all">
                    Go to Settings
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Video Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-white/20 w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/20 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">{selectedVideo.title}</h2>
              <button
                onClick={closeVideo}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Video Player Placeholder */}
              <div className="aspect-video bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg mb-6 relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                    <p className="text-lg font-medium">Video Player Placeholder</p>
                    <p className="text-sm text-gray-400">Duration: {selectedVideo.duration}</p>
                  </div>
                </div>
              </div>

              {/* Video Description */}
              <div className="text-gray-300">
                <p className="text-lg mb-4">{selectedVideo.description}</p>
                <div className="flex items-center space-x-4 text-sm">
                  <span className={`px-3 py-1 rounded-full ${
                    selectedVideo.category === 'getting-started' ? 'bg-green-500/20 text-green-400' :
                    selectedVideo.category === 'advanced' ? 'bg-purple-500/20 text-purple-400' :
                    selectedVideo.category === 'integrations' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-orange-500/20 text-orange-400'
                  }`}>
                    {selectedVideo.category.replace('-', ' ')}
                  </span>
                  <span className="text-gray-500">Duration: {selectedVideo.duration}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}