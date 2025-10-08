from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import uuid
import shutil
import logging
from dotenv import load_dotenv
import openai
import tempfile
import json
from werkzeug.utils import secure_filename
from moviepy.editor import VideoFileClip
import threading

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize OpenAI client
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    logger.warning("OPENAI_API_KEY not found in environment variables")
    openai_api_key = "dummy_key"  # For development without actual API calls

# Set the API key directly in the module
openai.api_key = openai_api_key

# Create Flask app
app = Flask(__name__, static_folder="static")
CORS(app)  # Enable CORS for all routes

# Create necessary directories
os.makedirs("uploads", exist_ok=True)
os.makedirs("static", exist_ok=True)
os.makedirs("static/js", exist_ok=True)

# In-memory storage for demo purposes
# In production, use a proper database
videos_db = {}
courses_db = {}

def extract_transcript(video_path):
    """Extract transcript from video using OpenAI Whisper API"""
    logger.info(f"Extracting transcript from {video_path}")
    
    try:
        # Extract audio from video
        with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as temp_audio:
            temp_audio_path = temp_audio.name
        
        video_clip = VideoFileClip(video_path)
        video_clip.audio.write_audiofile(temp_audio_path, logger=None)
        video_clip.close()
        
        # Use OpenAI Whisper API to transcribe the audio
        with open(temp_audio_path, "rb") as audio_file:
            response = openai.Audio.transcribe(
                "whisper-1",
                audio_file
            )
        
        # Clean up temporary file
        os.unlink(temp_audio_path)
        
        return response.text
    
    except Exception as e:
        logger.error(f"Transcript extraction error: {str(e)}")
        raise Exception(f"Transcript extraction failed: {str(e)}")

def generate_course(transcript, video_title):
    """Generate a course structure from the transcript using OpenAI with scenes and visual elements"""
    logger.info("Generating course from transcript with scenes and visual elements")
    
    try:
        # Use OpenAI to structure the transcript into a course with scenes
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": """
                You are a course creation expert and visual designer. Your task is to transform a video transcript into a well-structured course with engaging visual scenes and interactive quizzes.
                
                The course should include:
                1. A compelling title
                2. A concise description
                3. Multiple logical sections with appropriate titles
                4. Each section should contain multiple scenes with visual elements
                5. Quiz sections after every 2-3 content sections to test understanding
                
                For each scene, determine the appropriate visual elements based on the content:
                - Avatar: When presenting information that would benefit from a human presenter
                - Images: When visual aids would enhance understanding
                - Text: Key points, definitions, or important concepts
                - Shapes: For diagrams, flowcharts, or highlighting relationships
                
                For quiz sections, create 3-5 relevant questions that test understanding of the preceding content sections. Each question should have:
                - Clear, specific question text
                - 4 multiple choice options (A, B, C, D)
                - One correct answer
                - Explanations for why the correct answer is right
                
                Format your response as valid JSON with the following structure:
                {
                    "title": "Course Title",
                    "description": "Course description",
                    "sections": [
                        {
                            "title": "Section Title",
                            "type": "content|quiz",
                            "duration": "Estimated duration",
                            "scenes": [
                                {
                                    "scene_type": "introduction|content|summary",
                                    "narration": "Text to be narrated for this scene",
                                    "visual_elements": [
                                        {
                                            "type": "avatar",
                                            "position": "left|center|right",
                                            "emotion": "neutral|happy|serious|thoughtful",
                                            "style": "professional|casual|technical"
                                        },
                                        {
                                            "type": "image",
                                            "description": "Detailed description of the image needed",
                                            "position": "full|left|right|background",
                                            "style": "photo|illustration|diagram"
                                        },
                                        {
                                            "type": "text",
                                            "content": "Text content to display",
                                            "position": "top|middle|bottom",
                                            "style": "heading|bullet|quote|definition"
                                        },
                                        {
                                            "type": "shape",
                                            "shape_type": "arrow|rectangle|circle|line|star",
                                            "position": "coordinates or description",
                                            "purpose": "highlight|connect|separate"
                                        }
                                    ]
                                }
                            ],
                            "questions": [
                                {
                                    "question": "Question text here",
                                    "options": {
                                        "A": "Option A text",
                                        "B": "Option B text", 
                                        "C": "Option C text",
                                        "D": "Option D text"
                                    },
                                    "correct_answer": "A|B|C|D",
                                    "explanation": "Explanation of why this answer is correct"
                                }
                            ]
                        }
                    ],
                    "metadata": {
                        "source": "video transcript",
                        "difficulty": "beginner|intermediate|advanced",
                        "target_audience": "description of intended audience",
                        "estimated_total_duration": "total duration"
                    }
                }
                
                Notes:
                - Include only the visual elements that make sense for each scene
                - Ensure the narration text flows naturally with the visual elements
                - Make sure each scene has a clear purpose and communicates effectively
                - Use a variety of visual elements to maintain engagement
                - Keep the scenes focused and not overcrowded with too many elements
                - For quiz sections: set "type": "quiz" and include relevant questions
                - For content sections: set "type": "content" and focus on scenes
                - Add quiz sections after every 2-3 content sections
                - Quiz questions should test understanding of the preceding content sections
                - Make quiz questions challenging but fair, testing key concepts
                """},
                {"role": "user", "content": f"Video Title: {video_title}\n\nTranscript: {transcript}"}
            ]
        )
        
        course_data = response.choices[0].message['content']
        
        # Parse the JSON response
        try:
            course = json.loads(course_data)
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {str(e)}")
            logger.error(f"Received data: {course_data}")
            # Try to clean the response and parse again
            cleaned_data = course_data.strip()
            if cleaned_data.startswith('```json'):
                cleaned_data = cleaned_data[7:]
            if cleaned_data.endswith('```'):
                cleaned_data = cleaned_data[:-3]
            cleaned_data = cleaned_data.strip()
            course = json.loads(cleaned_data)
        
        return course
    
    except Exception as e:
        logger.error(f"Course generation error: {str(e)}")
        raise Exception(f"Course generation failed: {str(e)}")

def process_video(video_id):
    """Process the uploaded video: extract transcript and generate course"""
    if video_id not in videos_db:
        logger.error(f"Video ID {video_id} not found")
        return
    
    try:
        # Update status
        videos_db[video_id]["status"] = "processing"
        
        # Extract transcript
        transcript = extract_transcript(videos_db[video_id]["path"])
        logger.info(f"Transcript: {transcript}")
        videos_db[video_id]["transcript"] = transcript
        videos_db[video_id]["status"] = "transcript_extracted"
        
        # Generate course
        course = generate_course(transcript, videos_db[video_id]["title"])
        course_id = str(uuid.uuid4())
        courses_db[course_id] = course
        
        # Update video record with course ID
        videos_db[video_id]["course_id"] = course_id
        videos_db[video_id]["status"] = "completed"
        
    except Exception as e:
        logger.error(f"Error processing video {video_id}: {str(e)}")
        videos_db[video_id]["status"] = "error"
        videos_db[video_id]["error"] = str(e)

@app.route('/upload-video/', methods=['POST'])
def upload_video():
    """Upload a video file and start processing it"""
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if not file.filename:
        return jsonify({"error": "No selected file"}), 400
    
    if not file.filename.lower().endswith(('.mp4', '.mov', '.avi', '.wmv')):
        return jsonify({"error": "Invalid video file format"}), 400
    
    # Generate unique ID for the video
    video_id = str(uuid.uuid4())
    
    # Save the uploaded file
    filename = secure_filename(file.filename)
    file_path = f"uploads/{video_id}_{filename}"
    file.save(file_path)
    
    # Store video metadata
    video_title = request.form.get('title', filename)
    videos_db[video_id] = {
        "id": video_id,
        "title": video_title,
        "filename": filename,
        "path": file_path,
        "status": "uploaded",
        "transcript": None,
        "course_id": None
    }
    
    # Process the video in a background thread
    threading.Thread(target=process_video, args=(video_id,)).start()
    
    return jsonify({"video_id": video_id, "title": video_title, "status": "processing"})

@app.route('/video/<video_id>', methods=['GET'])
def get_video_status(video_id):
    """Get the status of a video processing job"""
    if video_id not in videos_db:
        return jsonify({"error": "Video not found"}), 404
    
    return jsonify(videos_db[video_id])

@app.route('/course/<course_id>', methods=['GET', 'PUT'])
def course_operations(course_id):
    """Get or update a generated course by ID"""
    if request.method == 'GET':
        if course_id not in courses_db:
            return jsonify({"error": "Course not found"}), 404
        
        return jsonify(courses_db[course_id])
    
    elif request.method == 'PUT':
        if course_id not in courses_db:
            return jsonify({"error": "Course not found"}), 404
        
        # Update course with new data
        updated_course = request.json
        courses_db[course_id] = updated_course
        
        return jsonify({"message": "Course updated successfully"})

@app.route('/', methods=['GET'])
def index():
    """Serve the index.html file"""
    return send_from_directory('static', 'index.html')

@app.route('/<path:path>', methods=['GET'])
def serve_static(path):
    """Serve static files"""
    return send_from_directory('static', path)

@app.route('/api', methods=['GET'])
def api_root():
    """API root endpoint"""
    return jsonify({"message": "Video to Course Generator API"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)