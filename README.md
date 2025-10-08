# Video to Course Generator

This application allows users to upload videos (such as knowledge sharing calls from Teams) and automatically generate structured courses with visual scenes. The system extracts the transcript from the video using OpenAI's Whisper API and then uses GPT-4 to transform the transcript into a well-structured course with scenes containing avatars, images, text, and shapes.

## Features

- Video upload and processing
- Automatic transcript extraction using OpenAI Whisper
- Scene-based course generation from transcript using OpenAI GPT-4
- Visual elements including avatars, images, text, and shapes
- Interactive React-based course player with scene navigation
- Advanced scene editor with drag and drop functionality
- Add, remove, and update visual elements with precise positioning
- Customizable avatars, text, images, and shapes
- Video playback mode with animations between scenes
- Multiple animation types (FadeIn, SlideIn, Pulse, Bounce)
- Canvas-based scene rendering with visual elements
- Simple and intuitive web interface
- Real-time processing status updates

## Prerequisites

- Python 3.8 to 3.12 (Note: Python 3.13 may have compatibility issues with some dependencies)
- OpenAI API key

## Installation

1. Clone this repository:
   ```
   git clone <repository-url>
   cd demo
   ```

2. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Create a `.env` file with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

## Usage

1. Test your installation:
   ```
   python test_install.py
   ```

2. Start the application:
   ```
   python app.py
   ```

3. Open your browser and navigate to `http://localhost:8000`

4. Upload a video file and optionally provide a title

5. Wait for the processing to complete - you'll see real-time status updates

6. Once processing is complete, the generated course will be displayed

## Technical Details

### Backend

- Flask for the REST API
- OpenAI Whisper API for transcript extraction
- OpenAI GPT-4 for course generation
- MoviePy for audio extraction from video

### Frontend

- HTML/CSS/JavaScript
- React for interactive course player
- HTML5 Canvas for scene rendering
- Bootstrap for styling
- Fetch API for communication with the backend

## API Endpoints

- `POST /upload-video/` - Upload a video file
- `GET /video/<video_id>` - Get video processing status
- `GET /course/<course_id>` - Get generated course
- `GET /api` - API root endpoint

## Future Enhancements

- User authentication and saved courses
- More customization options for course generation
- Support for different course formats and exports
- Integration with learning management systems
- Enhanced video processing capabilities
- Support for longer videos and improved chunking

## Troubleshooting

### Python 3.13 Compatibility

The application has been updated to use Flask instead of FastAPI to ensure compatibility with Python 3.13. This change was made because FastAPI and its dependency pydantic had compatibility issues with Python 3.13.

### OpenAI API Version

This application uses OpenAI API version 0.28.1, which is compatible with Python 3.13. The newer versions of the OpenAI library may have compatibility issues with Python 3.13.

### Common Issues

- **OpenAI API Key**: Ensure your API key is correctly set in the `.env` file
- **Video Processing**: For large videos, the processing might take a while
- **Memory Issues**: If processing large videos, ensure your system has enough memory

## License

[MIT License](LICENSE)
