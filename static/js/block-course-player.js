// Block-based Course Player: renders sections as a sequence of content blocks
class BlockCoursePlayer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      role: props.role || 'learner',
      editingIndex: null,
      draftBlock: null,
      isQuizOpen: false,
      currentQuiz: null,
      quizResults: {},
      answersBySection: {},
      submittedBySection: {},
      addMenuForSection: null
    };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.role !== this.props.role) {
      this.setState({ role: this.props.role, editingIndex: null, addMenuForSection: null });
    }
  }

  // Build a flat list of all blocks across sections with back-references
  getAllBlocks() {
    const { course } = this.props;
    if (!course || !course.sections) return [];
    const flattened = [];
    course.sections.forEach((section, sectionIndex) => {
      (section.blocks || []).forEach((block, blockIndex) => {
        flattened.push({ ...block, _sectionIndex: sectionIndex, _blockIndex: blockIndex, _sectionTitle: section.title });
      });
    });
    return flattened;
  }

  // Compute the flat index for a given (sectionIndex, blockIndex)
  getFlatIndexFor(sectionIndex, blockIndex) {
    const { course } = this.props;
    if (!course || !course.sections) return 0;
    let idx = 0;
    for (let s = 0; s < course.sections.length; s++) {
      const blocks = course.sections[s].blocks || [];
      if (s === sectionIndex) {
        idx += Math.min(blockIndex, blocks.length);
        break;
      }
      idx += blocks.length;
    }
    return idx;
  }

  startEdit = (idx, block) => {
    if (this.state.role !== 'author') return;
    // Create a deep copy as a draft
    this.setState({ editingIndex: idx, draftBlock: JSON.parse(JSON.stringify(block)) });
  }

  cancelEdit = () => this.setState({ editingIndex: null, draftBlock: null });

  updateDraft = (field, value) => {
    this.setState(prev => ({ draftBlock: { ...prev.draftBlock, [field]: value } }));
  }

  updateChecklistItem = (i, value) => {
    const items = Array.isArray(this.state.draftBlock.items) ? [...this.state.draftBlock.items] : [];
    items[i] = { text: value };
    this.updateDraft('items', items);
  }

  addChecklistItem = () => {
    const items = Array.isArray(this.state.draftBlock.items) ? [...this.state.draftBlock.items] : [];
    items.push({ text: '' });
    this.updateDraft('items', items);
  }

  removeChecklistItem = (i) => {
    const items = Array.isArray(this.state.draftBlock.items) ? [...this.state.draftBlock.items] : [];
    items.splice(i, 1);
    this.updateDraft('items', items);
  }

  saveEdit = () => {
    const { editingIndex, draftBlock } = this.state;
    if (editingIndex === null || !draftBlock) return;
    const all = this.getAllBlocks();
    const target = all[editingIndex];
    if (!target) return;
    const { _sectionIndex, _blockIndex } = target;
    // Update in the course data and propagate
    const updatedCourse = JSON.parse(JSON.stringify(this.props.course));
    if (!updatedCourse.sections[_sectionIndex].blocks) updatedCourse.sections[_sectionIndex].blocks = [];
    updatedCourse.sections[_sectionIndex].blocks[_blockIndex] = draftBlock;
    // Emit upstream for persistence
    if (this.props.onCourseUpdate) this.props.onCourseUpdate(updatedCourse);
    this.setState({ editingIndex: null, draftBlock: null });
  }

  deleteBlock = (sectionIndex, blockIndex) => {
    const updatedCourse = JSON.parse(JSON.stringify(this.props.course));
    if (!updatedCourse.sections[sectionIndex] || !updatedCourse.sections[sectionIndex].blocks) return;
    updatedCourse.sections[sectionIndex].blocks.splice(blockIndex, 1);
    if (this.props.onCourseUpdate) this.props.onCourseUpdate(updatedCourse);
  }

  addBlock = (sectionIndex, type) => {
    const updatedCourse = JSON.parse(JSON.stringify(this.props.course));
    if (!updatedCourse.sections[sectionIndex].blocks) updatedCourse.sections[sectionIndex].blocks = [];
    const defaults = {
      text: { type: 'text', content: 'New text block' },
      image: { type: 'image', url: '', alt: 'Image' },
      video: { type: 'video', source: '', timestamp: 0 },
      doc: { type: 'doc', title: 'Document', url: '' },
      flipcard: { type: 'flipcard', front: 'Term', back: 'Definition' },
      checklist: { type: 'checklist', items: [{ text: 'Item 1' }] }
    };
    updatedCourse.sections[sectionIndex].blocks.push(defaults[type] || defaults.text);
    if (this.props.onCourseUpdate) this.props.onCourseUpdate(updatedCourse);
    this.setState({ addMenuForSection: null });
  }

  // Quiz methods for block course mode
  openQuiz = (sectionIndex) => {
    const section = this.props.course.sections[sectionIndex];
    if (section && Array.isArray(section.questions) && section.questions.length > 0) {
      this.setState({
        isQuizOpen: true,
        currentQuiz: { ...section, sectionIndex, title: section.title || 'Quiz' }
      });
    } else {
      console.warn('Quiz section missing questions');
    }
  }

  closeQuiz = () => {
    this.setState({ isQuizOpen: false, currentQuiz: null });
  }

  handleQuizComplete = (score, totalQuestions) => {
    const { currentQuiz } = this.state;
    const percentage = Math.round((score / totalQuestions) * 100);
    const isPassing = percentage >= 70;
    this.setState(prev => ({
      quizResults: {
        ...prev.quizResults,
        [currentQuiz.sectionIndex]: { score, total: totalQuestions, percentage, passed: isPassing }
      }
    }));
  }

  handleQuizContinue = () => {
    const { currentQuiz } = this.state;
    this.closeQuiz();
    // Scroll to next section if present
    if (currentQuiz && typeof currentQuiz.sectionIndex === 'number') {
      const nextId = `section-${currentQuiz.sectionIndex + 1}`;
      const el = document.getElementById(nextId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  hasPassedQuiz = (sectionIndex) => {
    const r = this.state.quizResults[sectionIndex];
    return r && r.passed;
  }

  selectInlineAnswer = (sectionIndex, qIndex, optionKey) => {
    this.setState(prev => ({
      answersBySection: {
        ...prev.answersBySection,
        [sectionIndex]: {
          ...(prev.answersBySection[sectionIndex] || {}),
          [qIndex]: optionKey
        }
      }
    }));
  }

  submitInlineQuiz = (sectionIndex, questions) => {
    const answers = this.state.answersBySection[sectionIndex] || {};
    let score = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.correct_answer) score++;
    });
    const total = questions.length;
    const percentage = Math.round((score / total) * 100);
    const passed = percentage >= 70;
    this.setState(prev => ({
      quizResults: {
        ...prev.quizResults,
        [sectionIndex]: { score, total, percentage, passed }
      },
      submittedBySection: {
        ...prev.submittedBySection,
        [sectionIndex]: true
      }
    }));
  }

  renderBlock(block, idx) {
    switch (block.type) {
      case 'text':
        return (
          <div key={idx} className="p-4 bg-white rounded-lg shadow">
            {this.state.editingIndex === idx ? (
              <div className="space-y-2">
                <textarea className="w-full border rounded p-2"
                  rows={3}
                  value={this.state.draftBlock.content || ''}
                  onChange={e => this.updateDraft('content', e.target.value)} />
                {this.renderEditActions()}
              </div>
            ) : (
              <p className="text-gray-800">{block.content}</p>
            )}
            {this.renderEditButton(idx, block)}
          </div>
        );
      case 'image':
        return (
          <div key={idx} className="p-4 bg-white rounded-lg shadow flex flex-col items-center">
            <div className="w-full max-w-3xl bg-gray-200 rounded overflow-hidden">
              <img src="/images/image.png" alt={block.alt || 'Image placeholder'} className="w-full h-64 object-contain bg-white" />
            </div>
            {this.state.editingIndex === idx ? (
              <div className="w-full max-w-3xl mt-3 grid grid-cols-2 gap-2">
                <input className="border rounded p-2" placeholder="Image URL"
                  value={this.state.draftBlock.url || ''}
                  onChange={e => this.updateDraft('url', e.target.value)} />
                <input className="border rounded p-2" placeholder="Alt text"
                  value={this.state.draftBlock.alt || ''}
                  onChange={e => this.updateDraft('alt', e.target.value)} />
                <div className="col-span-2">{this.renderEditActions()}</div>
              </div>
            ) : (
              block.alt && <div className="mt-2 text-sm text-gray-600">{block.alt}</div>
            )}
            {this.renderEditButton(idx, block)}
          </div>
        );
      case 'video':
        return (
          <div key={idx} className="p-4 bg-white rounded-lg shadow">
            <div className="w-full rounded-lg overflow-hidden bg-black/5">
              <img src="/images/video.png" alt="Video placeholder" className="w-full h-64 object-contain bg-white" />
            </div>
            {this.state.editingIndex === idx ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input className="border rounded p-2" placeholder="Source URL"
                  value={this.state.draftBlock.source || ''}
                  onChange={e => this.updateDraft('source', e.target.value)} />
                <input className="border rounded p-2" placeholder="Timestamp (sec)" type="number"
                  value={this.state.draftBlock.timestamp || 0}
                  onChange={e => this.updateDraft('timestamp', Number(e.target.value))} />
                <div className="col-span-2">{this.renderEditActions()}</div>
              </div>
            ) : null}
            {this.renderEditButton(idx, block)}
          </div>
        );
      case 'doc':
        return (
          <div key={idx} className="p-4 bg-white rounded-lg shadow">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📄</span>
              <div>
                <div className="font-medium text-gray-800">{block.title || 'Document'}</div>
                {block.url && <div className="text-sm text-blue-600">{block.url}</div>}
              </div>
            </div>
            {this.state.editingIndex === idx ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input className="border rounded p-2" placeholder="Title"
                  value={this.state.draftBlock.title || ''}
                  onChange={e => this.updateDraft('title', e.target.value)} />
                <input className="border rounded p-2" placeholder="URL"
                  value={this.state.draftBlock.url || ''}
                  onChange={e => this.updateDraft('url', e.target.value)} />
                <div className="col-span-2">{this.renderEditActions()}</div>
              </div>
            ) : null}
            {this.renderEditButton(idx, block)}
          </div>
        );
      case 'flipcard':
        return (
          <div key={idx} className="p-4 bg-white rounded-lg shadow">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded text-center">{block.front}</div>
              <div className="p-4 border rounded text-center bg-gray-50">{block.back}</div>
            </div>
            {this.state.editingIndex === idx ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input className="border rounded p-2" placeholder="Front"
                  value={this.state.draftBlock.front || ''}
                  onChange={e => this.updateDraft('front', e.target.value)} />
                <input className="border rounded p-2" placeholder="Back"
                  value={this.state.draftBlock.back || ''}
                  onChange={e => this.updateDraft('back', e.target.value)} />
                <div className="col-span-2">{this.renderEditActions()}</div>
              </div>
            ) : null}
            {this.renderEditButton(idx, block)}
          </div>
        );
      case 'checklist':
        return (
          <div key={idx} className="p-4 bg-white rounded-lg shadow">
            <ul className="space-y-2">
              {(block.items || []).map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4" />
                  <span className="text-gray-800">{item.text}</span>
                </li>
              ))}
            </ul>
            {this.state.editingIndex === idx ? (
              <div className="mt-3 space-y-2">
                {(this.state.draftBlock.items || []).map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="border rounded p-2 flex-1" placeholder={`Item ${i+1}`}
                      value={item.text || ''}
                      onChange={e => this.updateChecklistItem(i, e.target.value)} />
                    <button className="px-2 py-1 bg-red-100 text-red-700 rounded" onClick={() => this.removeChecklistItem(i)}>Remove</button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-gray-200 rounded" onClick={this.addChecklistItem}>Add item</button>
                </div>
                {this.renderEditActions()}
              </div>
            ) : null}
            {this.renderEditButton(idx, block)}
          </div>
        );
      default:
        return (
          <div key={idx} className="p-4 bg-white rounded-lg shadow">
            <div className="text-gray-500 text-sm">Unsupported block type: {block.type}</div>
          </div>
        );
    }
  }

  renderEditButton(idx, block) {
    if (this.state.role !== 'author') return null;
    return (
      <div className="mt-3 flex gap-2 justify-end">
        {this.state.editingIndex === idx ? null : (
          <>
            <button
              className="p-2 rounded bg-blue-500 text-white"
              title="Edit"
              onClick={() => this.startEdit(idx, block)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
            </button>
            <button
              className="p-2 rounded bg-red-100 text-red-700"
              title="Delete"
              onClick={() => {
                // Need section/block indices; map via flat index
                const all = this.getAllBlocks();
                const target = all[idx];
                if (target) this.deleteBlock(target._sectionIndex, target._blockIndex);
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </>
        )}
      </div>
    );
  }

  renderEditActions() {
    return (
      <div className="flex gap-2 mt-2">
        <button className="px-3 py-1 bg-gray-200 rounded" onClick={this.cancelEdit}>Cancel</button>
        <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={this.saveEdit}>Save</button>
      </div>
    );
  }

  render() {
    const { course } = this.props;
    if (!course || !course.sections) return null;

    // Grouped rendering: show sections with their blocks underneath
    return (
      <div className="bg-white rounded-lg shadow p-4 space-y-6">
        {course.sections.length === 0 ? (
          <div className="p-6 bg-yellow-50 border border-yellow-200 rounded">
            <div className="text-yellow-800">No sections available.</div>
          </div>
        ) : (
          course.sections.map((section, sectionIdx) => (
            <div key={`section-${sectionIdx}`} id={`section-${sectionIdx}`} className="space-y-3">
              <div className="sticky top-0 bg-gray-50/80 backdrop-blur border-b px-2 py-2">
                <h3 className="text-lg font-semibold text-gray-800">{section.title || `Section ${sectionIdx + 1}`}</h3>
                {section.description && (
                  <div className="text-sm text-gray-600">{section.description}</div>
                )}
              </div>
              {(Array.isArray(section.questions) && section.questions.length > 0) && (
                <div className="p-4 bg-white rounded-lg shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-gray-800 font-medium">{section.title || 'Section'} – Quiz</div>
                      <div className="text-sm text-gray-600">{section.questions.length} questions to test understanding</div>
                    </div>
                    {this.state.submittedBySection[sectionIdx] && (
                      <div className={`text-sm font-semibold ${this.hasPassedQuiz(sectionIdx) ? 'text-green-700' : 'text-red-700'}`}>
                        {this.state.quizResults[sectionIdx].percentage}%
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    {section.questions.map((q, qi) => {
                      const submitted = !!this.state.submittedBySection[sectionIdx];
                      const chosen = (this.state.answersBySection[sectionIdx] || {})[qi];
                      const correct = q.correct_answer;
                      return (
                        <div key={`q-${qi}`} className="border rounded p-3">
                          <div className="font-medium text-gray-800 mb-2">{qi + 1}. {q.question}</div>
                          <div className="space-y-2">
                            {Object.entries(q.options || {}).map(([key, val]) => {
                              const isChosen = chosen === key;
                              const isCorrect = submitted && key === correct;
                              const isWrong = submitted && isChosen && key !== correct;
                              return (
                                <label key={key} className={`flex items-center gap-2 p-2 rounded border ${
                                  isCorrect ? 'border-green-500 bg-green-50' : isWrong ? 'border-red-500 bg-red-50' : 'border-gray-200'
                                }`}>
                                  <input
                                    type="radio"
                                    name={`s${sectionIdx}-q${qi}`}
                                    className="w-4 h-4"
                                    disabled={submitted}
                                    checked={isChosen || false}
                                    onChange={() => this.selectInlineAnswer(sectionIdx, qi, key)}
                                  />
                                  <span className="font-medium text-gray-700 w-5">{key}.</span>
                                  <span className="text-gray-800">{val}</span>
                                </label>
                              );
                            })}
                          </div>
                          {submitted && q.explanation && (
                            <div className="mt-2 text-sm text-gray-600"><span className="font-semibold">Explanation:</span> {q.explanation}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex justify-end">
                    {!this.state.submittedBySection[sectionIdx] ? (
                      <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={() => this.submitInlineQuiz(sectionIdx, section.questions)}>Submit</button>
                    ) : (
                      <span className={`text-sm ${this.hasPassedQuiz(sectionIdx) ? 'text-green-700' : 'text-red-700'}`}>
                        {this.hasPassedQuiz(sectionIdx) ? 'Passed' : 'Try again by changing your answers and re-submitting'}
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-4">
                {(section.blocks && section.blocks.length > 0) ? (
                  section.blocks.map((block, blockIdx) => {
                    const flatIdx = this.getFlatIndexFor(sectionIdx, blockIdx);
                    // Add section title to block for display if needed
                    const blockWithMeta = { ...block, _sectionTitle: section.title };
                    return (
                      <div key={`s${sectionIdx}-b${blockIdx}`}>
                        {this.renderBlock(blockWithMeta, flatIdx)}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 bg-white rounded border text-sm text-gray-500">No items in this section.</div>
                )}
                {this.state.role === 'author' && (
                  <div className="pt-2">
                    {this.state.addMenuForSection === sectionIdx ? (
                      <div className="flex flex-wrap gap-2">
                        {['text','image','video','doc','flipcard','checklist'].map(t => (
                          <button key={t} className="px-3 py-1 bg-gray-100 rounded border" onClick={() => this.addBlock(sectionIdx, t)}>
                            + {t}
                          </button>
                        ))}
                        <button className="px-3 py-1 bg-red-100 text-red-700 rounded" onClick={() => this.setState({ addMenuForSection: null })}>Cancel</button>
                      </div>
                    ) : (
                      <button className="px-3 py-1 bg-blue-500 text-white rounded" onClick={() => this.setState({ addMenuForSection: sectionIdx })}>
                        + Add item
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {this.state.isQuizOpen && this.state.currentQuiz && (
          <QuizModal
            isOpen={this.state.isQuizOpen}
            onClose={this.closeQuiz}
            questions={this.state.currentQuiz.questions}
            title={this.state.currentQuiz.title}
            timeLimit={300}
            passingScore={70}
            onQuizComplete={this.handleQuizComplete}
            onContinue={this.handleQuizContinue}
          />
        )}
      </div>
    );
  }
}

// Wrapper to switch between Scene and Block players
class DualCoursePlayer extends React.Component {
  constructor(props) {
    super(props);
    this.state = { view: props.initialView || 'scene', role: props.role || 'learner' };
  }
  render() {
    const { course, onCourseUpdate, role: propRole } = this.props;
    const { view, role } = this.state;
    return (
      <div>
        <div className="flex justify-end items-center mb-3">
          <div className="inline-flex border rounded overflow-hidden">
            <button
              className={`px-3 py-1 text-sm ${view === 'scene' ? 'bg-blue-500 text-white' : 'bg-white'}`}
              onClick={() => this.setState({ view: 'scene' })}
            >Video</button>
            <button
              className={`px-3 py-1 text-sm ${view === 'block' ? 'bg-blue-500 text-white' : 'bg-white'}`}
              onClick={() => this.setState({ view: 'block' })}
            >Course</button>
          </div>
        </div>
        {view === 'block' && (
          <div className="flex justify-end mb-3">
            <div className="inline-flex border rounded overflow-hidden">
              <button
                className={`px-3 py-1 text-sm ${role === 'learner' ? 'bg-blue-500 text-white' : 'bg-white'}`}
                onClick={() => this.setState({ role: 'learner' })}
              >Learner</button>
              <button
                className={`px-3 py-1 text-sm ${role === 'author' ? 'bg-blue-500 text-white' : 'bg-white'}`}
                onClick={() => this.setState({ role: 'author' })}
              >Author</button>
            </div>
          </div>
        )}
        {view === 'scene' ? (
          React.createElement(CoursePlayer, { course, onCourseUpdate, role: propRole })
        ) : (
          React.createElement(BlockCoursePlayer, { course, onCourseUpdate, role })
        )}
      </div>
    );
  }
}

function mountDualCoursePlayer(courseData, containerId, onCourseUpdate, options) {
  const container = document.getElementById(containerId);
  if (container && courseData) {
    ReactDOM.render(
      React.createElement(DualCoursePlayer, {
        course: courseData,
        onCourseUpdate,
        role: options && options.role ? options.role : 'learner',
        initialView: options && options.view ? options.view : 'scene'
      }),
      container
    );
  }
}


