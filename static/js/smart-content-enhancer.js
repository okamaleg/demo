// Smart Content Enhancement Component
class SmartContentEnhancer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isAnalyzing: false,
      analysis: null,
      suggestions: null,
      isGeneratingSuggestions: false,
      showEnhancedText: false,
      currentText: props.text || '',
      analysisHistory: [],
      selectedSuggestion: null
    };
    this.debounceTimer = null;
  }

  componentDidMount() {
    if (this.props.autoAnalyze && this.state.currentText) {
      this.analyzeContent();
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.text !== this.props.text) {
      this.setState({ currentText: this.props.text || '' });
      if (this.props.autoAnalyze && this.props.text) {
        this.debouncedAnalyze();
      }
    }
  }

  debouncedAnalyze = () => {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.analyzeContent();
    }, 1000);
  };

  analyzeContent = async () => {
    if (!this.state.currentText.trim()) {
      console.log('No text to analyze');
      return;
    }

    console.log('Starting content analysis for:', this.state.currentText.substring(0, 50) + '...');
    this.setState({ isAnalyzing: true, analysis: null });

    try {
      const response = await fetch('/api/analyze-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: this.state.currentText,
          type: this.props.contentType || 'narration'
        })
      });

      console.log('Analysis response status:', response.status);

      if (!response.ok) {
        throw new Error(`Analysis failed with status: ${response.status}`);
      }

      const analysis = await response.json();
      console.log('Analysis result:', analysis);
      
      this.setState({ 
        analysis,
        analysisHistory: [...this.state.analysisHistory, {
          timestamp: new Date(),
          text: this.state.currentText,
          analysis
        }]
      });

      if (this.props.onAnalysisComplete) {
        this.props.onAnalysisComplete(analysis);
      }
    } catch (error) {
      console.error('Content analysis error:', error);
      this.setState({ 
        analysis: {
          overall_score: 75,
          clarity_score: 75,
          engagement_score: 75,
          accessibility_score: 75,
          suggestions: [{
            type: 'error',
            priority: 'high',
            suggestion: 'Analysis failed. Please check your internet connection and try again.',
            reason: 'Unable to connect to analysis service'
          }],
          improved_text: this.state.currentText,
          key_insights: ['Analysis temporarily unavailable - check console for details']
        }
      });
    } finally {
      this.setState({ isAnalyzing: false });
    }
  };

  generateSuggestions = async () => {
    if (!this.props.courseId) return;

    this.setState({ isGeneratingSuggestions: true, suggestions: null });

    try {
      const url = this.props.sectionIndex !== undefined && this.props.sceneIndex !== undefined
        ? `/api/content-suggestions/${this.props.courseId}?section_index=${this.props.sectionIndex}&scene_index=${this.props.sceneIndex}`
        : `/api/content-suggestions/${this.props.courseId}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Suggestions generation failed');
      }

      const suggestions = await response.json();
      this.setState({ suggestions });

      if (this.props.onSuggestionsComplete) {
        this.props.onSuggestionsComplete(suggestions);
      }
    } catch (error) {
      console.error('Suggestions generation error:', error);
    } finally {
      this.setState({ isGeneratingSuggestions: false });
    }
  };

  applySuggestion = (suggestion) => {
    this.setState({ 
      currentText: suggestion,
      showEnhancedText: true
    });
    
    if (this.props.onTextChange) {
      this.props.onTextChange(suggestion);
    }
  };

  getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  getScoreBgColor = (score) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  render() {
    const { 
      analysis, 
      suggestions, 
      isAnalyzing, 
      isGeneratingSuggestions, 
      currentText,
      showEnhancedText,
      selectedSuggestion
    } = this.state;

    console.log('SmartContentEnhancer rendering with state:', { 
      analysis: !!analysis, 
      suggestions: !!suggestions, 
      isAnalyzing, 
      currentText: currentText?.substring(0, 50) + '...' 
    });

    return (
      <div className="smart-content-enhancer bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Smart Content Enhancement
          </h3>
          <div className="flex gap-2">
            <button
              onClick={this.analyzeContent}
              disabled={isAnalyzing || !currentText.trim()}
              className={`px-3 py-1 rounded text-sm font-medium ${
                isAnalyzing || !currentText.trim()
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {isAnalyzing ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analyzing...
                </span>
              ) : (
                'Analyze Content'
              )}
            </button>
            {this.props.courseId && (
              <button
                onClick={this.generateSuggestions}
                disabled={isGeneratingSuggestions}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  isGeneratingSuggestions
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                {isGeneratingSuggestions ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </span>
                ) : (
                  'Get Suggestions'
                )}
              </button>
            )}
          </div>
        </div>

        {/* Content Analysis Results */}
        {analysis && (
          <div className="mb-6">
            <h4 className="text-md font-semibold text-gray-700 mb-3">Content Analysis</h4>
            
            {/* Score Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className={`p-3 rounded-lg ${this.getScoreBgColor(analysis.overall_score)}`}>
                <div className="text-sm text-gray-600">Overall Score</div>
                <div className={`text-2xl font-bold ${this.getScoreColor(analysis.overall_score)}`}>
                  {analysis.overall_score}
                </div>
              </div>
              <div className={`p-3 rounded-lg ${this.getScoreBgColor(analysis.clarity_score)}`}>
                <div className="text-sm text-gray-600">Clarity</div>
                <div className={`text-2xl font-bold ${this.getScoreColor(analysis.clarity_score)}`}>
                  {analysis.clarity_score}
                </div>
              </div>
              <div className={`p-3 rounded-lg ${this.getScoreBgColor(analysis.engagement_score)}`}>
                <div className="text-sm text-gray-600">Engagement</div>
                <div className={`text-2xl font-bold ${this.getScoreColor(analysis.engagement_score)}`}>
                  {analysis.engagement_score}
                </div>
              </div>
              <div className={`p-3 rounded-lg ${this.getScoreBgColor(analysis.accessibility_score)}`}>
                <div className="text-sm text-gray-600">Accessibility</div>
                <div className={`text-2xl font-bold ${this.getScoreColor(analysis.accessibility_score)}`}>
                  {analysis.accessibility_score}
                </div>
              </div>
            </div>

            {/* Key Insights */}
            {analysis.key_insights && analysis.key_insights.length > 0 && (
              <div className="mb-4">
                <h5 className="text-sm font-semibold text-gray-700 mb-2">Key Insights</h5>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <ul className="space-y-1">
                    {analysis.key_insights.map((insight, index) => (
                      <li key={index} className="text-sm text-blue-800 flex items-start">
                        <span className="text-blue-500 mr-2">•</span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Improvement Suggestions */}
            {analysis.suggestions && analysis.suggestions.length > 0 && (
              <div className="mb-4">
                <h5 className="text-sm font-semibold text-gray-700 mb-2">Improvement Suggestions</h5>
                <div className="space-y-2">
                  {analysis.suggestions.map((suggestion, index) => (
                    <div key={index} className={`p-3 rounded-lg border ${this.getPriorityColor(suggestion.priority)}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-1">
                            <span className={`px-2 py-1 rounded text-xs font-medium mr-2 ${this.getPriorityColor(suggestion.priority)}`}>
                              {suggestion.priority.toUpperCase()}
                            </span>
                            <span className="text-sm font-medium capitalize">{suggestion.type}</span>
                          </div>
                          <p className="text-sm mb-1">{suggestion.suggestion}</p>
                          <p className="text-xs opacity-75">{suggestion.reason}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Enhanced Text */}
            {analysis.improved_text && analysis.improved_text !== currentText && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-sm font-semibold text-gray-700">Enhanced Version</h5>
                  <button
                    onClick={() => this.applySuggestion(analysis.improved_text)}
                    className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                  >
                    Apply Enhancement
                  </button>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">{analysis.improved_text}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Strategic Suggestions */}
        {suggestions && (
          <div className="mb-6">
            <h4 className="text-md font-semibold text-gray-700 mb-3">Strategic Suggestions</h4>
            
            {/* Content Gaps */}
            {suggestions.content_gaps && suggestions.content_gaps.length > 0 && (
              <div className="mb-4">
                <h5 className="text-sm font-semibold text-gray-700 mb-2">Content Gaps</h5>
                <div className="space-y-2">
                  {suggestions.content_gaps.map((gap, index) => (
                    <div key={index} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-sm font-medium text-orange-800">{gap.gap}</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${this.getPriorityColor(gap.importance)}`}>
                          {gap.importance.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-orange-700">{gap.suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Engagement Opportunities */}
            {suggestions.engagement_opportunities && suggestions.engagement_opportunities.length > 0 && (
              <div className="mb-4">
                <h5 className="text-sm font-semibold text-gray-700 mb-2">Engagement Opportunities</h5>
                <div className="space-y-2">
                  {suggestions.engagement_opportunities.map((opportunity, index) => (
                    <div key={index} className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-sm font-medium text-purple-800">{opportunity.opportunity}</span>
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                          {opportunity.type}
                        </span>
                      </div>
                      <p className="text-sm text-purple-700">{opportunity.implementation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Learning Flow Improvements */}
            {suggestions.learning_flow_improvements && suggestions.learning_flow_improvements.length > 0 && (
              <div className="mb-4">
                <h5 className="text-sm font-semibold text-gray-700 mb-2">Flow Improvements</h5>
                <div className="space-y-2">
                  {suggestions.learning_flow_improvements.map((improvement, index) => (
                    <div key={index} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-sm font-medium text-blue-800 mb-1">{improvement.issue}</div>
                      <p className="text-sm text-blue-700">{improvement.suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Difficulty Assessment */}
            {suggestions.difficulty_assessment && (
              <div className="mb-4">
                <h5 className="text-sm font-semibold text-gray-700 mb-2">Difficulty Assessment</h5>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs text-gray-600">Current Level</div>
                      <div className="text-sm font-medium text-gray-800 capitalize">
                        {suggestions.difficulty_assessment.current_level}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Target Audience</div>
                      <div className="text-sm font-medium text-gray-800">
                        {suggestions.difficulty_assessment.target_audience}
                      </div>
                    </div>
                    <div className="md:col-span-1">
                      <div className="text-xs text-gray-600">Complexity Notes</div>
                      <div className="text-sm text-gray-700">
                        {suggestions.difficulty_assessment.complexity_notes}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Analysis History */}
        {this.state.analysisHistory.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h5 className="text-sm font-semibold text-gray-700 mb-2">Analysis History</h5>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {this.state.analysisHistory.slice(-3).map((entry, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                  <span className="text-gray-600">
                    {entry.timestamp.toLocaleTimeString()} - Score: {entry.analysis.overall_score}
                  </span>
                  <button
                    onClick={() => this.setState({ analysis: entry.analysis })}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
}

// Helper function to mount the Smart Content Enhancer
function mountSmartContentEnhancer(containerId, props) {
  console.log('mountSmartContentEnhancer called with:', containerId, props);
  const container = document.getElementById(containerId);
  console.log('Container element:', container);
  
  if (container) {
    try {
      ReactDOM.render(
        React.createElement(SmartContentEnhancer, props),
        container
      );
      console.log('Smart content enhancer mounted successfully');
    } catch (error) {
      console.error('Error mounting smart content enhancer:', error);
    }
  } else {
    console.error('Container not found:', containerId);
  }
}
