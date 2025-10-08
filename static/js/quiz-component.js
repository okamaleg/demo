// Quiz Component for Interactive Learning
class QuizComponent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      currentQuestion: 0,
      answers: {},
      showResults: false,
      score: 0,
      timeRemaining: null,
      quizStarted: false
    };
  }

  startQuiz = () => {
    this.setState({ 
      quizStarted: true,
      timeRemaining: this.props.timeLimit || null 
    });
    
    if (this.props.timeLimit) {
      this.startTimer();
    }
  }

  startTimer = () => {
    this.timer = setInterval(() => {
      this.setState(prevState => {
        if (prevState.timeRemaining <= 1) {
          this.submitQuiz();
          return { timeRemaining: 0 };
        }
        return { timeRemaining: prevState.timeRemaining - 1 };
      });
    }, 1000);
  }

  selectAnswer = (questionIndex, answer) => {
    this.setState(prevState => ({
      answers: {
        ...prevState.answers,
        [questionIndex]: answer
      }
    }));
  }

  nextQuestion = () => {
    const { questions } = this.props;
    if (this.state.currentQuestion < questions.length - 1) {
      this.setState(prevState => ({
        currentQuestion: prevState.currentQuestion + 1
      }));
    } else {
      this.submitQuiz();
    }
  }

  prevQuestion = () => {
    if (this.state.currentQuestion > 0) {
      this.setState(prevState => ({
        currentQuestion: prevState.currentQuestion - 1
      }));
    }
  }

  submitQuiz = () => {
    if (this.timer) {
      clearInterval(this.timer);
    }
    
    const { questions } = this.props;
    let score = 0;
    
    questions.forEach((question, index) => {
      if (this.state.answers[index] === question.correct_answer) {
        score++;
      }
    });
    
    this.setState({
      showResults: true,
      score: score
    });
    
    if (this.props.onQuizComplete) {
      this.props.onQuizComplete(score, questions.length);
    }
  }

  retakeQuiz = () => {
    this.setState({
      currentQuestion: 0,
      answers: {},
      showResults: false,
      score: 0,
      quizStarted: false,
      timeRemaining: null
    });
  }

  formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  render() {
    const { questions, title } = this.props;
    const { currentQuestion, answers, showResults, score, timeRemaining, quizStarted } = this.state;
    
    if (!questions || questions.length === 0) {
      return (
        <div className="p-6 bg-white rounded-lg shadow-lg">
          <p className="text-gray-600">No questions available for this quiz.</p>
        </div>
      );
    }

    if (!quizStarted) {
      return (
        <div className="p-6 bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{title || 'Quiz'}</h2>
            <p className="text-gray-600 mb-6">
              This quiz contains {questions.length} questions to test your understanding of the material.
            </p>
            {this.props.timeLimit && (
              <p className="text-blue-600 mb-4">
                Time limit: {this.formatTime(this.props.timeLimit)}
              </p>
            )}
            <button
              onClick={this.startQuiz}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Start Quiz
            </button>
          </div>
        </div>
      );
    }

    if (showResults) {
      const percentage = Math.round((score / questions.length) * 100);
      const isPassing = percentage >= (this.props.passingScore || 70);
      
      return (
        <div className="p-6 bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Quiz Results</h2>
            
            <div className={`text-4xl font-bold mb-4 ${isPassing ? 'text-green-600' : 'text-red-600'}`}>
              {percentage}%
            </div>
            
            <p className="text-gray-600 mb-4">
              You scored {score} out of {questions.length} questions correctly.
            </p>
            
            <div className={`p-4 rounded-lg mb-6 ${isPassing ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className={`font-semibold ${isPassing ? 'text-green-800' : 'text-red-800'}`}>
                {isPassing ? 'Congratulations! You passed the quiz.' : 'You need to review the material and try again.'}
              </p>
            </div>

            {/* Show detailed results */}
            <div className="text-left mb-6">
              <h3 className="font-semibold text-gray-800 mb-3">Question Review:</h3>
              {questions.map((question, index) => {
                const userAnswer = answers[index];
                const isCorrect = userAnswer === question.correct_answer;
                
                return (
                  <div key={index} className={`p-3 rounded mb-2 ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
                    <p className="font-medium text-gray-800 mb-2">
                      {index + 1}. {question.question}
                    </p>
                    <p className={`text-sm ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                      Your answer: {userAnswer || 'Not answered'} 
                      {!isCorrect && ` (Correct: ${question.correct_answer})`}
                    </p>
                    {question.explanation && (
                      <p className="text-sm text-gray-600 mt-1">
                        <strong>Explanation:</strong> {question.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={this.retakeQuiz}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Retake Quiz
              </button>
              {isPassing && this.props.onContinue && (
                <button
                  onClick={this.props.onContinue}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  Continue Course
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    const currentQ = questions[currentQuestion];
    const userAnswer = answers[currentQuestion];
    
    return (
      <div className="p-6 bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
        {/* Timer */}
        {timeRemaining !== null && (
          <div className="text-right mb-4">
            <span className={`px-3 py-1 rounded text-sm font-medium ${
              timeRemaining < 60 ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {this.formatTime(timeRemaining)}
            </span>
          </div>
        )}

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Question {currentQuestion + 1} of {questions.length}</span>
            <span>{Math.round(((currentQuestion + 1) / questions.length) * 100)}% Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Question */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {currentQ.question}
          </h3>
          
          <div className="space-y-3">
            {Object.entries(currentQ.options).map(([key, value]) => (
              <label
                key={key}
                className={`block p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  userAnswer === key 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name={`question-${currentQuestion}`}
                  value={key}
                  checked={userAnswer === key}
                  onChange={() => this.selectAnswer(currentQuestion, key)}
                  className="sr-only"
                />
                <div className="flex items-center">
                  <span className="font-medium text-gray-700 mr-3">{key}.</span>
                  <span className="text-gray-800">{value}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={this.prevQuestion}
            disabled={currentQuestion === 0}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          
          <button
            onClick={this.nextQuestion}
            disabled={!userAnswer}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {currentQuestion === questions.length - 1 ? 'Submit Quiz' : 'Next Question'}
          </button>
        </div>
      </div>
    );
  }

  componentWillUnmount() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}

// Quiz Modal Component
class QuizModal extends React.Component {
  render() {
    if (!this.props.isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">Quiz</h2>
            <button
              onClick={this.props.onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>
          <div className="p-4">
            <QuizComponent
              questions={this.props.questions}
              title={this.props.title}
              timeLimit={this.props.timeLimit}
              passingScore={this.props.passingScore}
              onQuizComplete={this.props.onQuizComplete}
              onContinue={this.props.onContinue}
            />
          </div>
        </div>
      </div>
    );
  }
}
